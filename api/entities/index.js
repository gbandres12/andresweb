import { db } from '../_lib/database.js';
import { supabase } from '../_lib/supabase.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'andresweb-secret-jwt-key-2026';

const entityToTableMap = {
  Store: 'stores',
  Organization: 'organizations',
  User: 'users',
  Category: 'categories',
  Product: 'products',
  Customer: 'customers',
  Employee: 'employees',
  CashRegister: 'cash_registers',
  CashMovement: 'cash_movements',
  Sale: 'sales',
  CostCenter: 'cost_centers',
  Expense: 'expenses',
  Transaction: 'transactions',
  StockMovement: 'stock_movements',
  Transfer: 'transfers',
  Exchange: 'exchanges',
  Commission: 'commissions',
  ConciliationEntry: 'conciliation_entries'
};

const EXCLUDED_ENTITIES = new Set(['Store', 'User', 'Organization']);

// Helper para converter datas e remover campos inexistentes no banco
function sanitizeForSupabase(payload) {
  const clean = { ...payload };
  if (clean.created_date) {
    clean.created_at = clean.created_date;
    delete clean.created_date;
  }
  if (clean.updated_date) {
    clean.updated_at = clean.updated_date;
    delete clean.updated_date;
  }
  // Remove campos legados do NeDB/MongoDB
  delete clean._id;
  return clean;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Extração e validação do JWT do usuário
  let user = null;
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.warn('JWT inválido na rota de entidades:', err.message);
    }
  }

  try {
    // Restaura o path da entidade a partir da URL solicitada
    const requestUrl = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'] || req.url || '';
    const pathname = requestUrl.split('?')[0]; // Remove query params
    const parts = pathname.replace(/^\/api\/entities\/?/, '').split('/');
    
    const entityName = parts[0] || 'Store';
    const id = parts[1] || null;
    const tableName = entityToTableMap[entityName] || entityName.toLowerCase() + 's';

    // 2. Segurança: Validar acesso para entidades não públicas
    const isPublicLookup = (entityName === 'Product' && req.method === 'POST' && id === 'filter' && req.body?.criteria?.is_active === true) ||
                           (entityName === 'Product' && req.method === 'GET' && !id);

    if (!user && !isPublicLookup) {
      return res.status(401).json({ error: 'Autenticação necessária' });
    }

    // 3. Multi-tenancy: Configurar filtros baseados no tenant do usuário
    const isSuperAdmin = user?.role === 'superadmin';
    const storeIdFilter = !isSuperAdmin && !EXCLUDED_ENTITIES.has(entityName) ? user?.store_id : null;
    const organizationIdFilter = !isSuperAdmin ? user?.organization_id : null;

    // 4. Mapeamento de Métodos
    // 4.1 GET (Listar ou Buscar por ID)
    if (req.method === 'GET') {
      if (id) {
        let item = null;
        try {
          let query = supabase.from(tableName).select('*').eq('id', id);
          if (storeIdFilter) query = query.eq('store_id', storeIdFilter);
          else if (organizationIdFilter && tableName !== 'users' && tableName !== 'stores') {
            query = query.eq('organization_id', organizationIdFilter);
          }

          const { data, error } = await query.maybeSingle();
          if (error) throw error;
          item = data;
        } catch (e) {
          console.warn(`Erro GET ${tableName} no Supabase:`, e.message);
        }

        if (!item) {
          item = db.get(entityName, id);
          // Validar tenant no fallback local
          if (item && storeIdFilter && item.store_id !== storeIdFilter) item = null;
        }

        if (!item) return res.status(404).json({ error: 'Item nao encontrado' });
        return res.status(200).json(item);
      }

      let items = [];
      try {
        let query = supabase.from(tableName).select('*');
        
        if (storeIdFilter) {
          if (tableName === 'transfers') {
            query = query.or(`origin_store_id.eq.${storeIdFilter},destination_store_id.eq.${storeIdFilter}`);
          } else {
            query = query.eq('store_id', storeIdFilter);
          }
        } else if (organizationIdFilter) {
          if (tableName === 'users') {
            query = query.eq('organization_id', organizationIdFilter);
          } else if (tableName === 'stores') {
            query = query.eq('organization_id', organizationIdFilter);
          } else {
            query = query.eq('organization_id', organizationIdFilter);
          }
        }

        const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
        if (error) throw error;
        items = data || [];
      } catch (e) {
        console.warn(`Erro GET LIST ${tableName} no Supabase:`, e.message);
      }

      if (items.length === 0) {
        // Fallback local com escopo de tenant
        items = db.list(entityName);
        if (storeIdFilter) {
          items = items.filter(i => i.store_id === storeIdFilter || (entityName === 'Transfer' && (i.origin_store_id === storeIdFilter || i.destination_store_id === storeIdFilter)));
        } else if (organizationIdFilter) {
          items = items.filter(i => i.organization_id === organizationIdFilter);
        }
      }

      return res.status(200).json(items);
    }

    // 4.2 POST (Criar ou Filtrar)
    if (req.method === 'POST') {
      if (id === 'filter') {
        const { criteria = {}, sort, limit } = req.body || {};
        
        // Injetar escopo de tenant nos critérios
        const mergedCriteria = { ...criteria };
        if (storeIdFilter) {
          mergedCriteria.store_id = storeIdFilter;
        } else if (organizationIdFilter && !EXCLUDED_ENTITIES.has(entityName)) {
          mergedCriteria.organization_id = organizationIdFilter;
        }

        let items = [];
        try {
          let query = supabase.from(tableName).select('*');
          
          for (const [key, value] of Object.entries(mergedCriteria)) {
            if (key.startsWith('$')) continue; // ignorar seletores complexos legados
            if (value && typeof value === 'object') {
              if (Array.isArray(value.$in)) {
                query = query.in(key, value.$in);
              } else if (value.$regex) {
                query = query.ilike(key, `%${value.$regex}%`);
              }
            } else {
              query = query.eq(key, value);
            }
          }

          if (sort) {
            const desc = sort.startsWith('-');
            const col = desc ? sort.slice(1) : sort;
            query = query.order(col === 'created_date' ? 'created_at' : col, { ascending: !desc });
          } else {
            query = query.order('created_at', { ascending: false });
          }

          if (limit) query = query.limit(limit);
          
          const { data, error } = await query;
          if (error) throw error;
          items = data || [];
        } catch (e) {
          console.warn(`Erro FILTER ${tableName} no Supabase:`, e.message);
        }

        if (items.length === 0) {
          items = db.filter(entityName, mergedCriteria, sort, limit);
        }
        return res.status(200).json(items);
      }

      // Criar item
      const bodyData = req.body || {};
      const newId = bodyData.id || db.generateId();
      
      // Injetar tenants automaticamente
      const payload = { 
        id: newId, 
        ...bodyData 
      };

      if (!EXCLUDED_ENTITIES.has(entityName)) {
        if (storeIdFilter && !payload.store_id) payload.store_id = storeIdFilter;
        if (organizationIdFilter && !payload.organization_id) payload.organization_id = organizationIdFilter;
      } else {
        if (entityName === 'Store' && organizationIdFilter && !payload.organization_id) {
          payload.organization_id = organizationIdFilter;
        }
        if (entityName === 'User' && organizationIdFilter && !payload.organization_id) {
          payload.organization_id = organizationIdFilter;
        }
      }

      // Sanitizar dados para o banco Supabase
      const cleanPayload = sanitizeForSupabase(payload);

      try {
        const { error } = await supabase.from(tableName).insert(cleanPayload);
        if (error) throw error;
      } catch (e) {
        console.warn(`Erro INSERT ${tableName} no Supabase:`, e.message);
      }

      const createdItem = db.create(entityName, payload);
      return res.status(200).json(createdItem);
    }

    // 4.3 PUT (Atualizar)
    if (req.method === 'PUT') {
      const updateId = id || req.body?.id;
      if (!updateId) return res.status(400).json({ error: 'ID e obrigatorio para atualizacao' });

      // Injetar tenants por segurança caso tentem desviar
      const bodyData = req.body || {};
      const cleanPayload = sanitizeForSupabase(bodyData);

      try {
        let query = supabase.from(tableName).update(cleanPayload).eq('id', updateId);
        if (storeIdFilter) query = query.eq('store_id', storeIdFilter);
        else if (organizationIdFilter && !EXCLUDED_ENTITIES.has(entityName)) {
          query = query.eq('organization_id', organizationIdFilter);
        }

        const { error } = await query;
        if (error) throw error;
      } catch (e) {
        console.warn(`Erro UPDATE ${tableName} no Supabase:`, e.message);
      }

      const updated = db.update(entityName, updateId, bodyData);
      return res.status(200).json(updated || bodyData);
    }

    // 4.4 DELETE (Deletar)
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID e obrigatorio para remocao' });

      try {
        let query = supabase.from(tableName).delete().eq('id', id);
        if (storeIdFilter) query = query.eq('store_id', storeIdFilter);
        else if (organizationIdFilter && !EXCLUDED_ENTITIES.has(entityName)) {
          query = query.eq('organization_id', organizationIdFilter);
        }

        const { error } = await query;
        if (error) throw error;
      } catch (e) {
        console.warn(`Erro DELETE ${tableName} no Supabase:`, e.message);
      }

      db.delete(entityName, id);
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Erro na rota de entidades:', err);
    return res.status(500).json({ error: err.message });
  }
}
