import express from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const EXCLUDED_ENTITIES = new Set(['Store', 'User']);

// Middleware para aplicar escopo de loja (multi-tenant)
function getTenantFilter(req, entityName, rawFilter = {}) {
  if (EXCLUDED_ENTITIES.has(entityName)) {
    return rawFilter;
  }
  const storeId = req.user?.store_id;
  if (!storeId) return rawFilter;

  return {
    ...rawFilter,
    store_id: storeId
  };
}

// Listar / Filtrar entidades
router.get('/entities/:entity', authMiddleware, (req, res) => {
  try {
    const { entity } = req.params;
    const { _sort, _limit, ...rawCriteria } = req.query;

    const sort = _sort || '-created_date';
    const limit = Number(_limit) || 1000;

    let filter = getTenantFilter(req, entity, rawCriteria);
    const items = db.filter(entity, filter, sort, limit);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post / Filter dinâmico (post-body criteria)
router.post('/entities/:entity/filter', authMiddleware, (req, res) => {
  try {
    const { entity } = req.params;
    const { criteria = {}, sort = '-created_date', limit = 1000 } = req.body;

    let filter = getTenantFilter(req, entity, criteria);
    const items = db.filter(entity, filter, sort, limit);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obter por ID
router.get('/entities/:entity/:id', authMiddleware, (req, res) => {
  try {
    const { entity, id } = req.params;
    const item = db.get(entity, id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar item
router.post('/entities/:entity', authMiddleware, (req, res) => {
  try {
    const { entity } = req.params;
    let payload = { ...req.body };

    if (!EXCLUDED_ENTITIES.has(entity) && req.user?.store_id && !payload.store_id) {
      payload.store_id = req.user.store_id;
    }

    const created = db.create(entity, payload);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar em lote (bulk)
router.post('/entities/:entity/bulk', authMiddleware, (req, res) => {
  try {
    const { entity } = req.params;
    let items = req.body;
    if (!Array.isArray(items)) items = [items];

    const storeId = req.user?.store_id;
    if (!EXCLUDED_ENTITIES.has(entity) && storeId) {
      items = items.map(item => item.store_id ? item : { ...item, store_id: storeId });
    }

    const created = db.bulkCreate(entity, items);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar item
router.put('/entities/:entity/:id', authMiddleware, (req, res) => {
  try {
    const { entity, id } = req.params;
    const updated = db.update(entity, id, req.body);
    if (!updated) return res.status(404).json({ error: 'Item não encontrado para atualização' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar item
router.delete('/entities/:entity/:id', authMiddleware, (req, res) => {
  try {
    const { entity, id } = req.params;
    const success = db.delete(entity, id);
    if (!success) return res.status(404).json({ error: 'Item não encontrado para exclusão' });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
