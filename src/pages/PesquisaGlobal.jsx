import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Loader2, Globe, Store as StoreIcon, AlertTriangle, PackageCheck, PackageX, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function PesquisaGlobal() {
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);

  const load = useCallback(async (q = query) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('globalProductSearch', { query: q });
      setStores(res.data?.stores || []);
      setProducts(res.data?.products || []);
    } catch {
      toast.error('Erro ao buscar produtos das lojas');
    } finally { setLoading(false); }
  }, [query]);

  useEffect(() => { load(''); }, []);

  const storeName = id => stores.find(s => s.id === id)?.name || 'Loja';

  // Agrupa produtos por chave normalizada (sku > gtin > nome)
  const groups = useMemo(() => {
    const map = {};
    for (const p of products) {
      const key = (p.sku || p.gtin || p.name || '').toString().toLowerCase().trim();
      if (!key) continue;
      if (!map[key]) {
        map[key] = { name: p.name, sku: p.sku, gtin: p.gtin, category: p.category, price: p.price, byStore: {} };
      }
      const stock = (p.variants || []).reduce((s, v) => s + (v.stock || 0), 0);
      const cur = map[key].byStore[p.store_id] || { stock: 0, count: 0 };
      map[key].byStore[p.store_id] = { stock: cur.stock + stock, count: cur.count + 1 };
      if (!map[key].price && p.price) map[key].price = p.price;
    }
    return Object.values(map).map(g => {
      const presence = {};
      for (const s of stores) presence[s.id] = g.byStore[s.id] || null;
      const storesWith = stores.filter(s => presence[s.id]);
      const storesWithout = stores.filter(s => !presence[s.id]);
      return { ...g, presence, storesWith, storesWithout, hasGap: storesWith.length > 0 && storesWithout.length > 0 };
    });
  }, [products, stores]);

  const rows = useMemo(() => groups.filter(r => (onlyGaps ? r.hasGap : true)), [groups, onlyGaps]);
  const totalGaps = useMemo(() => groups.filter(g => g.hasGap).length, [groups]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Globe className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-semibold">Pesquisa Global</h1>
          <p className="text-sm text-muted-foreground">Cruze o catálogo de todas as suas lojas — veja onde cada produto existe e onde falta.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4 border-t-2 border-t-primary">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><StoreIcon className="w-3.5 h-3.5" /><span className="text-xs">Lojas</span></div>
          <p className="text-xl font-serif font-semibold tabular-nums">{stores.length}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 border-t-2 border-t-slate-400">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><PackageCheck className="w-3.5 h-3.5" /><span className="text-xs">Produtos catalogados</span></div>
          <p className="text-xl font-serif font-semibold tabular-nums">{rows.length}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 border-t-2 border-t-amber-500">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><AlertTriangle className="w-3.5 h-3.5" /><span className="text-xs">Lacunas de distribuição</span></div>
          <p className="text-xl font-serif font-semibold tabular-nums text-amber-600">{totalGaps}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 border-t-2 border-t-emerald-500">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><PackageCheck className="w-3.5 h-3.5" /><span className="text-xs">Em todas as lojas</span></div>
          <p className="text-xl font-serif font-semibold tabular-nums text-emerald-600">{rows.filter(r => !r.hasGap && stores.length > 1).length}</p>
        </div>
      </div>

      {/* Search + toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(); }}
            placeholder="Buscar por nome, SKU, GTIN ou tag em todas as lojas..."
            className="pl-9 h-10"
          />
        </div>
        <Button variant="outline" onClick={() => load()} disabled={loading} className="h-10">
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          Buscar
        </Button>
        <label className="flex items-center gap-2 px-3 h-10 rounded-lg border border-border bg-card cursor-pointer text-sm whitespace-nowrap">
          <input type="checkbox" checked={onlyGaps} onChange={e => setOnlyGaps(e.target.checked)} className="rounded" />
          Apenas lacunas
        </label>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Buscando produtos em {stores.length || 'suas'} loja(s)...</p>
          </div>
        ) : stores.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Você ainda não possui lojas cadastradas.
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            {onlyGaps ? 'Nenhuma lacuna encontrada — todos os produtos estão em todas as lojas.' : 'Nenhum produto encontrado para a busca.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase sticky left-0 bg-muted/40">Produto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">SKU / GTIN</th>
                  {stores.map(s => (
                    <th key={s.id} className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">{s.name}</th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Lacunas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={cn('border-b border-border last:border-0 hover:bg-muted/20', r.hasGap && 'bg-amber-50/40')}>
                    <td className="px-5 py-3 sticky left-0 bg-card">
                      <p className="text-sm font-medium leading-tight">{r.name}</p>
                      {r.category && <p className="text-xs text-muted-foreground">{r.category}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {r.sku && <p className="font-mono">{r.sku}</p>}
                      {r.gtin && <p className="font-mono">{r.gtin}</p>}
                    </td>
                    {stores.map(s => {
                      const cell = r.presence[s.id];
                      return (
                        <td key={s.id} className="px-4 py-3 text-center">
                          {cell ? (
                            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full tabular-nums',
                              cell.stock > 0 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600')}>
                              {cell.stock} un
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-600">
                              <PackageX className="w-3 h-3" /> falta
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      {r.hasGap ? (
                        <span className="text-xs text-amber-700 font-medium">{r.storesWithout.map(s => s.name).join(', ')}</span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}