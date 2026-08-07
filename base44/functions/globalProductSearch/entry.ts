import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const query = (body?.query || '').toString().trim();
    const limit = Math.min(Number(body?.limit) || 2000, 5000);

    // Lojas que pertencem a este usuário (criadas por ele) + loja ativa do perfil
    const allStores = await base44.asServiceRole.entities.Store.list('-created_date', 500);
    const myStores = allStores.filter(
      s => s.created_by_id === user.id || s.id === user.data?.store_id
    );

    if (myStores.length === 0) return Response.json({ stores: [], products: [] });

    const storeIds = myStores.map(s => s.id);

    // Produtos de todas as lojas do usuário (service role bypassa o RLS de loja ativa)
    let filter = { store_id: { $in: storeIds } };
    if (query) {
      const rx = { $regex: query, $options: 'i' };
      filter = { store_id: { $in: storeIds }, $or: [{ name: rx }, { sku: rx }, { gtin: rx }, { tags: rx }] };
    }
    const products = await base44.asServiceRole.entities.Product.filter(filter, '-created_date', limit);

    return Response.json({ stores: myStores, products });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}