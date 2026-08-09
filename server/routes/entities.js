import express from 'express';
import { db } from '../db/database.js';
import { supabase } from '../../api/_lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const EXCLUDED_ENTITIES = new Set(['Store', 'User', 'Organization']);

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
  delete clean._id;
  return clean;
}

// Helper para obter parâmetros de multi-tenancy
function getTenantFilters(req, entityName) {
  const isSuperAdmin = req.user?.role === 'superadmin';
  const storeIdFilter = !isSuperAdmin && !EXCLUDED_ENTITIES.has(entityName) ? req.user?.store_id : null;
  const organizationIdFilter = !isSuperAdmin ? req.user?.organization_id : null;
  return { storeIdFilter, organizationIdFilter };
}

// 1. Listar Entidades
router.get('/entities/:entity', authMiddleware, async (req, res) => {
  try {
    const { entity } = req.params;
    const { _sort, _limit, ...rawCriteria } = req.query;

    const sort = _sort || '-created_date';
    const limit = Number(_limit) || 1000;
    const tableName = entityToTableMap[entity] || entity.toLowerCase() + 's';

    const { storeIdFilter, organizationIdFilter } = getTenantFilters(req, entity);

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
        query = query.eq('organization_id', organizationIdFilter);
      }

      // Aplicar critérios de query params simples
      for (const [key, value] of Object.entries(rawCriteria)) {
        query = query.eq(key, value);
      }

      const desc = sort.startsWith('-');
      const col = desc ? sort.slice(1) : sort;
      
      const { data, error } = await query
        .order(col === 'created_date' ? 'created_at' : col, { ascending: !desc })
        .limit(limit);

      if (error) throw error;
      items = data || [];
    } catch (e) {
      console.warn(`Erro GET LIST ${tableName} no Supabase local:`, e.message);
    }

    if (items.length === 0) {
      // Fallback local
      const filter = { ...rawCriteria };
      if (storeIdFilter) filter.store_id = storeIdFilter;
      else if (organizationIdFilter && !EXCLUDED_ENTITIES.has(entity)) filter.organization_id = organizationIdFilter;

      items = db.filter(entity, filter, sort, limit);
      if (entity === 'Transfer' && storeIdFilter) {
        items = db.list(entity).filter(i => i.origin_store_id === storeIdFilter || i.destination_store_id === storeIdFilter);
      }
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Filtrar Entidades (POST)
router.post('/entities/:entity/filter', authMiddleware, async (req, res) => {
  try {
    const { entity } = req.params;
    const { criteria = {}, sort = '-created_date', limit = 1000 } = req.body;
    const tableName = entityToTableMap[entity] || entity.toLowerCase() + 's';

    const { storeIdFilter, organizationIdFilter } = getTenantFilters(req, entity);

    const mergedCriteria = { ...criteria };
    if (storeIdFilter) {
      mergedCriteria.store_id = storeIdFilter;
    } else if (organizationIdFilter && !EXCLUDED_ENTITIES.has(entity)) {
      mergedCriteria.organization_id = organizationIdFilter;
    }

    let items = [];
    try {
      let query = supabase.from(tableName).select('*');
      
      for (const [key, value] of Object.entries(mergedCriteria)) {
        if (key.startsWith('$')) continue;
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

      const desc = sort.startsWith('-');
      const col = desc ? sort.slice(1) : sort;
      
      const { data, error } = await query
        .order(col === 'created_date' ? 'created_at' : col, { ascending: !desc })
        .limit(limit);

      if (error) throw error;
      items = data || [];
    } catch (e) {
      console.warn(`Erro FILTER ${tableName} no Supabase local:`, e.message);
    }

    if (items.length === 0) {
      items = db.filter(entity, mergedCriteria, sort, limit);
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Obter por ID
router.get('/entities/:entity/:id', authMiddleware, async (req, res) => {
  try {
    const { entity, id } = req.params;
    const tableName = entityToTableMap[entity] || entity.toLowerCase() + 's';

    const { storeIdFilter, organizationIdFilter } = getTenantFilters(req, entity);

    let item = null;
    try {
      let query = supabase.from(tableName).select('*').eq('id', id);
      if (storeIdFilter) query = query.eq('store_id', storeIdFilter);
      else if (organizationIdFilter && !EXCLUDED_ENTITIES.has(entity)) {
        query = query.eq('organization_id', organizationIdFilter);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      item = data;
    } catch (e) {
      console.warn(`Erro GET ${tableName} por ID no Supabase local:`, e.message);
    }

    if (!item) {
      item = db.get(entity, id);
      if (item && storeIdFilter && item.store_id !== storeIdFilter) item = null;
      if (item && organizationIdFilter && !EXCLUDED_ENTITIES.has(entity) && item.organization_id !== organizationIdFilter) item = null;
    }

    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Criar Item
router.post('/entities/:entity', authMiddleware, async (req, res) => {
  try {
    const { entity } = req.params;
    const tableName = entityToTableMap[entity] || entity.toLowerCase() + 's';
    const { storeIdFilter, organizationIdFilter } = getTenantFilters(req, entity);

    let payload = { ...req.body };
    if (!payload.id) payload.id = db.generateId();

    if (!EXCLUDED_ENTITIES.has(entity)) {
      if (storeIdFilter && !payload.store_id) payload.store_id = storeIdFilter;
      if (organizationIdFilter && !payload.organization_id) payload.organization_id = organizationIdFilter;
    } else {
      if (entity === 'Store' && organizationIdFilter && !payload.organization_id) payload.organization_id = organizationIdFilter;
      if (entity === 'User' && organizationIdFilter && !payload.organization_id) payload.organization_id = organizationIdFilter;
    }

    const cleanPayload = sanitizeForSupabase(payload);

    try {
      const { error } = await supabase.from(tableName).insert(cleanPayload);
      if (error) throw error;
    } catch (e) {
      console.warn(`Erro INSERT ${tableName} no Supabase local:`, e.message);
    }

    const created = db.create(entity, payload);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Criar em Lote (Bulk)
router.post('/entities/:entity/bulk', authMiddleware, async (req, res) => {
  try {
    const { entity } = req.params;
    const tableName = entityToTableMap[entity] || entity.toLowerCase() + 's';
    const { storeIdFilter, organizationIdFilter } = getTenantFilters(req, entity);

    let items = req.body;
    if (!Array.isArray(items)) items = [items];

    const mappedItems = items.map(item => {
      const payload = { id: item.id || db.generateId(), ...item };
      if (!EXCLUDED_ENTITIES.has(entity)) {
        if (storeIdFilter && !payload.store_id) payload.store_id = storeIdFilter;
        if (organizationIdFilter && !payload.organization_id) payload.organization_id = organizationIdFilter;
      }
      return payload;
    });

    const cleanPayloads = mappedItems.map(sanitizeForSupabase);

    try {
      const { error } = await supabase.from(tableName).insert(cleanPayloads);
      if (error) throw error;
    } catch (e) {
      console.warn(`Erro BULK INSERT ${tableName} no Supabase local:`, e.message);
    }

    const created = db.bulkCreate(entity, mappedItems);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Atualizar Item
router.put('/entities/:entity/:id', authMiddleware, async (req, res) => {
  try {
    const { entity, id } = req.params;
    const tableName = entityToTableMap[entity] || entity.toLowerCase() + 's';
    const { storeIdFilter, organizationIdFilter } = getTenantFilters(req, entity);

    const bodyData = req.body || {};
    const cleanPayload = sanitizeForSupabase(bodyData);

    try {
      let query = supabase.from(tableName).update(cleanPayload).eq('id', id);
      if (storeIdFilter) query = query.eq('store_id', storeIdFilter);
      else if (organizationIdFilter && !EXCLUDED_ENTITIES.has(entity)) {
        query = query.eq('organization_id', organizationIdFilter);
      }

      const { error } = await query;
      if (error) throw error;
    } catch (e) {
      console.warn(`Erro UPDATE ${tableName} no Supabase local:`, e.message);
    }

    const updated = db.update(entity, id, bodyData);
    if (!updated) return res.status(404).json({ error: 'Item não encontrado para atualização' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Deletar Item
router.delete('/entities/:entity/:id', authMiddleware, async (req, res) => {
  try {
    const { entity, id } = req.params;
    const tableName = entityToTableMap[entity] || entity.toLowerCase() + 's';
    const { storeIdFilter, organizationIdFilter } = getTenantFilters(req, entity);

    try {
      let query = supabase.from(tableName).delete().eq('id', id);
      if (storeIdFilter) query = query.eq('store_id', storeIdFilter);
      else if (organizationIdFilter && !EXCLUDED_ENTITIES.has(entity)) {
        query = query.eq('organization_id', organizationIdFilter);
      }

      const { error } = await query;
      if (error) throw error;
    } catch (e) {
      console.warn(`Erro DELETE ${tableName} no Supabase local:`, e.message);
    }

    const success = db.delete(entity, id);
    if (!success) return res.status(404).json({ error: 'Item não encontrado para exclusão' });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
