import { db } from '../_lib/database.js';
import { supabase } from '../_lib/supabase.js';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Restaura o path da entidade a partir da URL solicitada
    const requestUrl = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'] || req.url || '';
    const pathname = requestUrl.split('?')[0]; // Remove query params
    const parts = pathname.replace(/^\/api\/entities\/?/, '').split('/');
    
    const entityName = parts[0] || 'Store';
    const id = parts[1] || null;
    const tableName = entityToTableMap[entityName] || entityName.toLowerCase() + 's';

    // 1. GET (Listar ou Buscar por ID)
    if (req.method === 'GET') {
      if (id) {
        let item = null;
        try {
          const { data } = await supabase.from(tableName).select('*').eq('id', id).maybeSingle();
          item = data;
        } catch (e) {}

        if (!item) {
          item = db.get(entityName, id);
        }

        if (!item) return res.status(404).json({ error: 'Item nao encontrado' });
        return res.status(200).json(item);
      }

      let items = [];
      try {
        const { data } = await supabase.from(tableName).select('*').order('created_at', { ascending: false }).limit(1000);
        items = data || [];
      } catch (e) {}

      if (items.length === 0) {
        items = db.list(entityName);
      }

      return res.status(200).json(items);
    }

    // 2. POST (Criar ou Filtrar)
    if (req.method === 'POST') {
      if (id === 'filter') {
        const { criteria, sort, limit } = req.body || {};
        let filtered = db.filter(entityName, criteria, sort, limit);
        return res.status(200).json(filtered);
      }

      const bodyData = req.body || {};
      const newId = bodyData.id || db.generateId();
      const payload = { id: newId, ...bodyData };

      try {
        await supabase.from(tableName).insert(payload);
      } catch (e) {
        console.warn(`Erro ao salvar ${tableName} no Supabase:`, e.message);
      }

      const createdItem = db.create(entityName, payload);
      return res.status(200).json(createdItem);
    }

    // 3. PUT (Atualizar)
    if (req.method === 'PUT') {
      const updateId = id || req.body?.id;
      if (!updateId) return res.status(400).json({ error: 'ID e obrigatorio para atualizacao' });

      try {
        await supabase.from(tableName).update(req.body).eq('id', updateId);
      } catch (e) {}

      const updated = db.update(entityName, updateId, req.body);
      return res.status(200).json(updated || req.body);
    }

    // 4. DELETE (Deletar)
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID e obrigatorio para remocao' });

      try {
        await supabase.from(tableName).delete().eq('id', id);
      } catch (e) {}

      db.delete(entityName, id);
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Erro na rota de entidades:', err);
    return res.status(500).json({ error: err.message });
  }
}
