import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const userName = user.full_name || user.email || '—';

    const {
      original_sale_id, returned_items, new_items,
      reason, payment_method, refund_method, notes,
      customer_id, customer_name, original_sale_number,
    } = body;

    if (!original_sale_id || !Array.isArray(returned_items) || !Array.isArray(new_items)) {
      return Response.json({ error: 'original_sale_id, returned_items e new_items são obrigatórios' }, { status: 400 });
    }
    if (!returned_items.length || !new_items.length) {
      return Response.json({ error: 'Informe ao menos uma peça devolvida e uma nova peça' }, { status: 400 });
    }

    const sale = await svc.entities.Sale.get(original_sale_id);
    if (!sale) return Response.json({ error: 'Venda original não encontrada' }, { status: 404 });
    const storeId = sale.store_id;

    const sameVariant = (v, size, color) =>
      String(v?.size || '') === String(size || '') && String(v?.color || '') === String(color || '');

    // Valida estoque das novas peças
    for (const it of new_items) {
      const prod = await svc.entities.Product.get(it.product_id);
      if (!prod) return Response.json({ error: `Produto ${it.product_name} não encontrado` }, { status: 400 });
      const v = (prod.variants || []).find(x => sameVariant(x, it.variant_size, it.variant_color));
      if (!v || (v.stock || 0) < (it.quantity || 0)) {
        return Response.json({
          error: `Estoque insuficiente de ${it.product_name} (${it.variant_size || '-'}/${it.variant_color || '-'}): disponível ${v?.stock || 0}`
        }, { status: 400 });
      }
    }

    const returned_value = +(returned_items.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 0), 0)).toFixed(2);
    const new_value = +(new_items.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 0), 0)).toFixed(2);
    const difference = +(new_value - returned_value).toFixed(2);

    const number = `TROCA-${Date.now().toString().slice(-6)}`;

    // Devoluções -> entrada de estoque
    for (const it of returned_items) {
      if (!it.product_id) continue;
      const prod = await svc.entities.Product.get(it.product_id);
      if (!prod) continue;
      const variants = (prod.variants || []).map(v =>
        sameVariant(v, it.variant_size, it.variant_color)
          ? { ...v, stock: (v.stock || 0) + (it.quantity || 0) }
          : v
      );
      await svc.entities.Product.update(prod.id, { variants });
      await svc.entities.StockMovement.create({
        store_id: storeId, product_id: prod.id, product_name: prod.name,
        variant_size: it.variant_size, variant_color: it.variant_color,
        type: 'entrada', quantity: it.quantity,
        reason: `Troca ${number} — devolução`,
      });
    }

    // Novas peças -> saída de estoque
    for (const it of new_items) {
      const prod = await svc.entities.Product.get(it.product_id);
      const variants = (prod.variants || []).map(v =>
        sameVariant(v, it.variant_size, it.variant_color)
          ? { ...v, stock: (v.stock || 0) - (it.quantity || 0) }
          : v
      );
      await svc.entities.Product.update(prod.id, { variants });
      await svc.entities.StockMovement.create({
        store_id: storeId, product_id: prod.id, product_name: prod.name,
        variant_size: it.variant_size, variant_color: it.variant_color,
        type: 'saida', quantity: it.quantity,
        reason: `Troca ${number} — saída`,
      });
    }

    const exchange = await svc.entities.Exchange.create({
      store_id: storeId,
      exchange_number: number,
      original_sale_id,
      original_sale_number: original_sale_number || sale.sale_number,
      customer_id: customer_id || sale.customer_id,
      customer_name: customer_name || sale.customer_name,
      returned_items, new_items,
      returned_value, new_value, difference,
      reason: reason || 'outros',
      payment_method: payment_method || null,
      refund_method: refund_method || null,
      status: 'concluida',
      operator_name: userName,
      notes: notes || '',
    });

    // Transação da diferença (receita se cliente paga, despesa se loja devolve)
    if (difference !== 0) {
      const month = new Date().toISOString().slice(0, 7);
      if (difference > 0) {
        await svc.entities.Transaction.create({
          store_id: storeId,
          description: `Troca ${number} — diferença a pagar`,
          amount: difference, type: 'receita', category: 'Troca',
          payment_method: payment_method || 'Outros', status: 'pago', month,
          customer_id: customer_id || sale.customer_id,
          customer_name: customer_name || sale.customer_name,
        });
      } else {
        await svc.entities.Transaction.create({
          store_id: storeId,
          description: `Troca ${number} — diferença a devolver`,
          amount: Math.abs(difference), type: 'despesa', category: 'Troca',
          payment_method: refund_method || 'Outros', status: 'pago', month,
          customer_name: customer_name || sale.customer_name,
        });
      }
    }

    return Response.json({ ok: true, exchange_id: exchange.id, exchange_number: number, difference });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}