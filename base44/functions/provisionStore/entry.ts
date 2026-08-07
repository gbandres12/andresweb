import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const BUSINESS_ENTITIES = [
  'Product', 'Sale', 'Customer', 'Expense',
  'Transaction', 'StockMovement', 'Category'
];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const storeId = body?.store_id;
    if (!storeId) return Response.json({ error: 'store_id é obrigatório' }, { status: 400 });

    // Backfill: atribui store_id a registros legados criados por este usuário que ainda não têm store_id.
    // Usa asServiceRole para bypassar o RLS (que exigiria store_id já presente no registro).
    const results = {};
    let totalBackfilled = 0;

    for (const name of BUSINESS_ENTITIES) {
      try {
        const res = await base44.asServiceRole.entities[name].updateMany(
          { created_by_id: user.id, store_id: { $exists: false } },
          { $set: { store_id: storeId } }
        );
        const count = res?.modified_count ?? res?.modifiedCount ?? 0;
        results[name] = count;
        totalBackfilled += count;
      } catch (e) {
        results[name] = { error: e.message };
      }
    }

    return Response.json({ ok: true, store_id: storeId, backfilled: totalBackfilled, details: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}