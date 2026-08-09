import express from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const sameVariant = (v, size, color) =>
  String(v?.size || '') === String(size || '') && String(v?.color || '') === String(color || '');

// Processar Troca (processExchange)
router.post('/functions/processExchange', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const body = req.body || {};
    const userName = user.full_name || user.email || '—';

    const {
      mode = 'troca', original_sale_id, returned_items, new_items,
      reason, payment_method, refund_method, notes,
      customer_id, customer_name, original_sale_number,
    } = body;

    if (!original_sale_id || !Array.isArray(returned_items)) {
      return res.status(400).json({ error: 'original_sale_id e returned_items são obrigatórios' });
    }
    if (!returned_items.length) {
      return res.status(400).json({ error: 'Informe ao menos uma peça devolvida' });
    }
    if (mode === 'troca' && (!Array.isArray(new_items) || !new_items.length)) {
      return res.status(400).json({ error: 'Informe ao menos uma nova peça para a troca' });
    }
    if (mode === 'credito' && !customer_id) {
      return res.status(400).json({ error: 'Selecione um cliente para creditar o saldo' });
    }

    const sale = db.get('Sale', original_sale_id);
    if (!sale) return res.status(404).json({ error: 'Venda original não encontrada' });
    const storeId = sale.store_id || user.store_id;

    // Valida estoque das novas peças (modo troca)
    if (mode === 'troca') {
      for (const it of new_items) {
        const prod = db.get('Product', it.product_id);
        if (!prod) return res.status(400).json({ error: `Produto ${it.product_name} não encontrado` });
        const v = (prod.variants || []).find(x => sameVariant(x, it.variant_size, it.variant_color));
        if (!v || (v.stock || 0) < (it.quantity || 0)) {
          return res.status(400).json({
            error: `Estoque insuficiente de ${it.product_name} (${it.variant_size || '-'}/${it.variant_color || '-'}): disponível ${v?.stock || 0}`
          });
        }
      }
    }

    const returned_value = +(returned_items.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 0), 0)).toFixed(2);
    const new_value = mode === 'troca'
      ? +(new_items.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 0), 0)).toFixed(2)
      : 0;
    const difference = mode === 'credito'
      ? +(-returned_value).toFixed(2)
      : +(new_value - returned_value).toFixed(2);

    const number = `TROCA-${Date.now().toString().slice(-6)}`;

    // Devoluções -> entrada de estoque
    for (const it of returned_items) {
      if (!it.product_id) continue;
      const prod = db.get('Product', it.product_id);
      if (!prod) continue;
      const variants = (prod.variants || []).map(v =>
        sameVariant(v, it.variant_size, it.variant_color)
          ? { ...v, stock: (v.stock || 0) + (it.quantity || 0) }
          : v
      );
      db.update('Product', prod.id, { variants });
      db.create('StockMovement', {
        store_id: storeId, product_id: prod.id, product_name: prod.name,
        variant_size: it.variant_size, variant_color: it.variant_color,
        type: 'entrada', quantity: it.quantity,
        reason: `Troca ${number} — devolução`,
      });
    }

    // Novas peças -> saída de estoque (modo troca)
    if (mode === 'troca') {
      for (const it of new_items) {
        const prod = db.get('Product', it.product_id);
        const variants = (prod.variants || []).map(v =>
          sameVariant(v, it.variant_size, it.variant_color)
            ? { ...v, stock: (v.stock || 0) - (it.quantity || 0) }
            : v
        );
        db.update('Product', prod.id, { variants });
        db.create('StockMovement', {
          store_id: storeId, product_id: prod.id, product_name: prod.name,
          variant_size: it.variant_size, variant_color: it.variant_color,
          type: 'saida', quantity: it.quantity,
          reason: `Troca ${number} — saída`,
        });
      }
    }

    // Crédito da loja (modo credito)
    if (mode === 'credito') {
      const cust = db.get('Customer', customer_id);
      if (cust) {
        db.update('Customer', customer_id, {
          credit_balance: (cust.credit_balance || 0) + returned_value,
        });
      }
    }

    const exchange = db.create('Exchange', {
      store_id: storeId,
      exchange_number: number,
      exchange_type: mode,
      original_sale_id,
      original_sale_number: original_sale_number || sale.sale_number,
      customer_id: customer_id || sale.customer_id,
      customer_name: customer_name || sale.customer_name,
      returned_items,
      new_items: mode === 'troca' ? new_items : [],
      returned_value, new_value, difference,
      reason: reason || 'outros',
      payment_method: payment_method || null,
      refund_method: refund_method || null,
      status: 'concluida',
      operator_name: userName,
      notes: notes || '',
    });

    if (difference !== 0) {
      const month = new Date().toISOString().slice(0, 7);
      if (difference > 0) {
        db.create('Transaction', {
          store_id: storeId,
          description: `Troca ${number} — diferença a pagar`,
          amount: difference, type: 'receita', category: 'Troca',
          payment_method: payment_method || 'Outros', status: 'pago', month,
          customer_id: customer_id || sale.customer_id,
          customer_name: customer_name || sale.customer_name,
        });
      } else {
        db.create('Transaction', {
          store_id: storeId,
          description: mode === 'credito' ? `Crédito gerado ${number}` : `Troca ${number} — diferença a devolver`,
          amount: Math.abs(difference), type: 'despesa', category: 'Troca',
          payment_method: refund_method || 'Outros', status: 'pago', month,
          customer_name: customer_name || sale.customer_name,
        });
      }
    }

    res.json({
      ok: true, exchange_id: exchange.id, exchange_number: number,
      difference, credit_balance: mode === 'credito' ? returned_value : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transferência de Estoque (transferStock)
router.post('/functions/transferStock', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const body = req.body || {};
    const action = body?.action;
    const transferId = body?.transfer_id;

    if (!action || !transferId) {
      return res.status(400).json({ error: 'action e transfer_id são obrigatórios' });
    }

    const transfer = db.get('Transfer', transferId);
    if (!transfer) return res.status(404).json({ error: 'Guia não encontrada' });

    const userName = user.full_name || user.email || '—';

    // DISPATCH
    if (action === 'dispatch') {
      if (transfer.status !== 'rascunho') {
        return res.status(400).json({ error: 'Apenas guias em rascunho podem ser despachadas' });
      }
      for (const item of transfer.items || []) {
        const prod = db.get('Product', item.product_id);
        if (!prod) {
          return res.status(400).json({ error: `Produto ${item.product_name} não encontrado na origem` });
        }
        const v = (prod.variants || []).find(x => sameVariant(x, item.variant_size, item.variant_color));
        if (!v || (v.stock || 0) < (item.quantity || 0)) {
          return res.status(400).json({
            error: `Estoque insuficiente de ${item.product_name} (${item.variant_size || '-'}/${item.variant_color || '-'}): disponível ${v?.stock || 0}, solicitado ${item.quantity || 0}`
          });
        }
      }
      for (const item of transfer.items || []) {
        const prod = db.get('Product', item.product_id);
        const variants = (prod.variants || []).map(v =>
          sameVariant(v, item.variant_size, item.variant_color)
            ? { ...v, stock: (v.stock || 0) - (item.quantity || 0) }
            : v
        );
        db.update('Product', prod.id, { variants });
        db.create('StockMovement', {
          store_id: transfer.origin_store_id,
          product_id: prod.id,
          product_name: prod.name,
          variant_size: item.variant_size,
          variant_color: item.variant_color,
          type: 'saida',
          quantity: item.quantity,
          reason: `Transferência ${transfer.transfer_number} → ${transfer.destination_store_name}`,
        });
      }
      db.update('Transfer', transferId, {
        status: 'em_transito',
        dispatched_at: new Date().toISOString(),
        dispatched_by: userName,
      });
      return res.json({ ok: true, status: 'em_transito' });
    }

    // RECEIVE
    if (action === 'receive') {
      if (transfer.status !== 'em_transito') {
        return res.status(400).json({ error: 'Apenas guias em trânsito podem ser recebidas' });
      }
      const receivedMap = body?.received || {};
      let allMatched = true;
      const updatedItems = [];

      for (const item of transfer.items || []) {
        const key = `${item.product_id}|${item.variant_size}|${item.variant_color}`;
        const recvQty = Math.max(0, Number(receivedMap[key] ?? item.quantity));
        updatedItems.push({ ...item, received_quantity: recvQty });
        if (recvQty !== item.quantity) allMatched = false;

        if (recvQty > 0) {
          const originProd = db.get('Product', item.product_id);
          if (!originProd) continue;

          let dest = null;
          if (originProd.sku) {
            const r = db.filter('Product', { store_id: transfer.destination_store_id, sku: originProd.sku });
            dest = r?.[0];
          }
          if (!dest && originProd.gtin) {
            const r = db.filter('Product', { store_id: transfer.destination_store_id, gtin: originProd.gtin });
            dest = r?.[0];
          }
          if (!dest) {
            dest = db.create('Product', {
              store_id: transfer.destination_store_id,
              name: originProd.name,
              description: originProd.description,
              category: originProd.category,
              price: originProd.price,
              price_tables: originProd.price_tables,
              cost_price: originProd.cost_price,
              sku: originProd.sku,
              gtin: originProd.gtin,
              images: originProd.images,
              is_active: originProd.is_active ?? true,
              variants: [{ size: item.variant_size, color: item.variant_color, stock: recvQty, sku: originProd.sku }],
            });
          } else {
            const variants = (dest.variants || []).slice();
            const idx = variants.findIndex(v => sameVariant(v, item.variant_size, item.variant_color));
            if (idx >= 0) {
              variants[idx] = { ...variants[idx], stock: (variants[idx].stock || 0) + recvQty };
            } else {
              variants.push({ size: item.variant_size, color: item.variant_color, stock: recvQty, sku: originProd.sku });
            }
            db.update('Product', dest.id, { variants });
          }

          db.create('StockMovement', {
            store_id: transfer.destination_store_id,
            product_id: dest.id,
            product_name: dest.name,
            variant_size: item.variant_size,
            variant_color: item.variant_color,
            type: 'entrada',
            quantity: recvQty,
            reason: `Recebimento transferência ${transfer.transfer_number} ← ${transfer.origin_store_name}`,
          });
        }
      }

      const status = allMatched ? 'recebido' : 'parcial';
      const diffCount = (transfer.items || []).length - updatedItems.filter(i => i.received_quantity === i.quantity).length;
      const lossNotes = allMatched ? '' : `Diferença em ${diffCount} item(ns) — conferir perdas.`;

      db.update('Transfer', transferId, {
        status,
        received_at: new Date().toISOString(),
        received_by: userName,
        items: updatedItems,
        loss_notes: lossNotes,
      });
      return res.json({ ok: true, status, loss_notes: lossNotes });
    }

    return res.status(400).json({ error: 'ação inválida (use dispatch ou receive)' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Provisionar Loja (provisionStore)
router.post('/functions/provisionStore', authMiddleware, (req, res) => {
  try {
    const user = req.user;
    const storeId = req.body?.store_id;
    if (!storeId) return res.status(400).json({ error: 'store_id é obrigatório' });

    res.json({ ok: true, store_id: storeId, backfilled: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pesquisa Global (globalProductSearch)
router.post('/functions/globalProductSearch', authMiddleware, (req, res) => {
  try {
    const user = req.user;
    const query = (req.body?.query || '').toString().trim();
    const limit = Math.min(Number(req.body?.limit) || 2000, 5000);

    const allStores = db.list('Store', '-created_date', 500);
    const myStores = allStores.filter(s => s.created_by_id === user.id || s.id === user.store_id);

    if (myStores.length === 0) return res.json({ stores: [], products: [] });

    const storeIds = myStores.map(s => s.id);
    let filter = { store_id: { $in: storeIds } };
    if (query) {
      filter = {
        store_id: { $in: storeIds },
        $or: [{ name: { $regex: query } }, { sku: { $regex: query } }, { gtin: { $regex: query } }]
      };
    }
    const products = db.filter('Product', filter, '-created_date', limit);

    res.json({ stores: myStores, products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
