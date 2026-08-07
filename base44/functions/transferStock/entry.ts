import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const transferId = body?.transfer_id;
    if (!action || !transferId) {
      return Response.json({ error: 'action e transfer_id são obrigatórios' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const transfer = await svc.entities.Transfer.get(transferId);
    if (!transfer) return Response.json({ error: 'Guia não encontrada' }, { status: 404 });

    const userName = user.full_name || user.email || '—';
    const sameVariant = (v, size, color) =>
      String(v?.size || '') === String(size || '') && String(v?.color || '') === String(color || '');

    // ===== DISPATCH: decrementa estoque da origem =====
    if (action === 'dispatch') {
      if (transfer.status !== 'rascunho') {
        return Response.json({ error: 'Apenas guias em rascunho podem ser despachadas' }, { status: 400 });
      }
      // Valida estoque suficiente na origem
      for (const item of transfer.items || []) {
        const prod = await svc.entities.Product.get(item.product_id);
        if (!prod) {
          return Response.json({ error: `Produto ${item.product_name} não encontrado na origem` }, { status: 400 });
        }
        const v = (prod.variants || []).find(x => sameVariant(x, item.variant_size, item.variant_color));
        if (!v || (v.stock || 0) < (item.quantity || 0)) {
          return Response.json({
            error: `Estoque insuficiente de ${item.product_name} (${item.variant_size || '-'}/${item.variant_color || '-'}): disponível ${v?.stock || 0}, solicitado ${item.quantity || 0}`
          }, { status: 400 });
        }
      }
      // Decrementa e loga movimentações
      for (const item of transfer.items || []) {
        const prod = await svc.entities.Product.get(item.product_id);
        const variants = (prod.variants || []).map(v =>
          sameVariant(v, item.variant_size, item.variant_color)
            ? { ...v, stock: (v.stock || 0) - (item.quantity || 0) }
            : v
        );
        await svc.entities.Product.update(prod.id, { variants });
        await svc.entities.StockMovement.create({
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
      await svc.entities.Transfer.update(transferId, {
        status: 'em_transito',
        dispatched_at: new Date().toISOString(),
        dispatched_by: userName,
      });
      return Response.json({ ok: true, status: 'em_transito' });
    }

    // ===== RECEIVE: incrementa estoque do destino, detecta perdas =====
    if (action === 'receive') {
      if (transfer.status !== 'em_transito') {
        return Response.json({ error: 'Apenas guias em trânsito podem ser recebidas' }, { status: 400 });
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
          const originProd = await svc.entities.Product.get(item.product_id);
          if (!originProd) continue;

          // Localiza produto equivalente no destino (por SKU > GTIN > nome)
          let dest = null;
          if (originProd.sku) {
            const r = await svc.entities.Product.filter({ store_id: transfer.destination_store_id, sku: originProd.sku }, '-created_date', 5);
            dest = r?.[0];
          }
          if (!dest && originProd.gtin) {
            const r = await svc.entities.Product.filter({ store_id: transfer.destination_store_id, gtin: originProd.gtin }, '-created_date', 5);
            dest = r?.[0];
          }
          if (!dest) {
            // Clona o produto no destino com a variante recebida
            dest = await svc.entities.Product.create({
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
            // Adiciona/incrementa a variante no destino
            const variants = (dest.variants || []).slice();
            const idx = variants.findIndex(v => sameVariant(v, item.variant_size, item.variant_color));
            if (idx >= 0) {
              variants[idx] = { ...variants[idx], stock: (variants[idx].stock || 0) + recvQty };
            } else {
              variants.push({ size: item.variant_size, color: item.variant_color, stock: recvQty, sku: originProd.sku });
            }
            await svc.entities.Product.update(dest.id, { variants });
          }

          await svc.entities.StockMovement.create({
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

      await svc.entities.Transfer.update(transferId, {
        status,
        received_at: new Date().toISOString(),
        received_by: userName,
        items: updatedItems,
        loss_notes: lossNotes,
      });
      return Response.json({ ok: true, status, loss_notes: lossNotes });
    }

    return Response.json({ error: 'ação inválida (use dispatch ou receive)' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}