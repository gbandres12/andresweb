import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Save, RefreshCw, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useStore } from '@/lib/StoreContext';
import { PRICE_TABLES, PRICE_TABLE_DEFAULTS, fmtPct } from '@/lib/priceTables';
import { cn } from '@/lib/utils';

export default function TabelaPrecoManager() {
  const { store, reload } = useStore();
  const { toast } = useToast();
  const [values, setValues] = useState({ ...PRICE_TABLE_DEFAULTS });
  const [basePreview, setBasePreview] = useState(100);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [count, setCount] = useState(null);

  useEffect(() => {
    const sd = store?.settings?.price_tables_defaults;
    if (sd && typeof sd === 'object') setValues({ ...PRICE_TABLE_DEFAULTS, ...sd });
  }, [store]);

  useEffect(() => {
    base44.entities.Product.list('-updated_date', 1).then(r => setCount(r?.length ?? null)).catch(() => {});
  }, []);

  const setVal = (k, v) => {
    if (v === '' || v === '-') return setValues(p => ({ ...p, [k]: v }));
    const n = Number(v);
    setValues(p => ({ ...p, [k]: Number.isNaN(n) ? 0 : n }));
  };

  const dirty = JSON.stringify(values) !== JSON.stringify({ ...PRICE_TABLE_DEFAULTS, ...(store?.settings?.price_tables_defaults || {}) });

  const save = async () => {
    const cleaned = {};
    Object.keys(values).forEach(k => { cleaned[k] = Number(values[k]) || 0; });
    setSaving(true);
    try {
      const settings = { ...(store?.settings || {}), price_tables_defaults: cleaned };
      await base44.entities.Store.update(store.id, { settings });
      toast({ title: 'Tabelas de preço salvas' });
      await reload();
    } catch {
      toast({ title: 'Erro ao salvar tabelas', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const applyToAll = async () => {
    if (!window.confirm('Aplicar estes percentuais a TODOS os produtos? Os valores individuais atuais de cada tabela serão substituídos.')) return;
    setApplying(true);
    try {
      const products = await base44.entities.Product.list('-updated_date', 500);
      const cleaned = {};
      Object.keys(values).forEach(k => { cleaned[k] = Number(values[k]) || 0; });
      let done = 0;
      let hasMore = true;
      while (hasMore) {
        const batch = products.slice(done, done + 500);
        if (!batch.length) break;
        const updates = batch.map(p => ({ id: p.id, price_tables: { ...cleaned } }));
        await base44.entities.Product.bulkUpdate(updates);
        done += batch.length;
        if (products.length <= done) hasMore = false;
      }
      toast({ title: `${products.length} produtos atualizados`, description: 'Todos os produtos agora usam os percentuais configurados.' });
    } catch {
      toast({ title: 'Erro ao aplicar aos produtos', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const eff = (pct) => {
    const n = Number(pct) || 0;
    return Math.round((basePreview * (1 + n / 100)) * 100) / 100;
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" /> Tabelas de Preço
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Configure o ajuste percentual de cada tabela em relação ao preço base do produto. Os valores definidos aqui tornam-se os padrões para novos produtos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={applyToAll} disabled={applying}>
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Aplicar a todos os produtos
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar padrões
            </Button>
          </div>
        </div>
      </div>

      {/* Tabelas */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tabela</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preço base</span>
            <Input
              type="number" min="0" step="0.01" value={basePreview}
              onChange={e => setBasePreview(Number(e.target.value) || 0)}
              className="h-7 w-24 text-right tabular-nums"
            />
          </div>
        </div>
        <div className="divide-y divide-border">
          {PRICE_TABLES.map(t => {
            const v = values[t.key] ?? 0;
            const hasValue = store?.settings?.price_tables_defaults?.[t.key] !== undefined;
            return (
              <div key={t.key} className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 px-5 py-4">
                <div className="sm:col-span-4">
                  <p className="font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{TABLE_DESC[t.key]}</p>
                </div>
                <div className="sm:col-span-3 flex items-center gap-2">
                  <Input
                    type="number" step="0.5" value={v}
                    onChange={e => setVal(t.key, e.target.value)}
                    className="h-9 w-24 tabular-nums"
                  />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
                <div className="sm:col-span-5 flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Ajuste</p>
                    <p className={cn('text-sm font-medium tabular-nums', (Number(v) || 0) < 0 ? 'text-destructive' : (Number(v) || 0) > 0 ? 'text-green-600' : 'text-muted-foreground')}>
                      {fmtPct(Number(v) || 0)}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-border hidden sm:block" />
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Preço final</p>
                    <p className="text-sm font-serif font-semibold tabular-nums text-foreground">
                      R$ {eff(v).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: o preço base fica no cadastro de cada produto. Estes percentuais são aplicados sobre ele para formar o preço exibido no PDV conforme a tabela escolhida.
        {count !== null && <> Atualmente você tem <strong className="text-foreground">{count}</strong> {count === 1 ? 'produto cadastrado' : 'produtos cadastrados'}.</>}
      </p>
    </div>
  );
}

const TABLE_DESC = {
  cliente_final: 'Preço cheio para consumidor final.',
  atacado: 'Desconto para venda em quantidade (atacado).',
  revenda: 'Desconto para revendedores parceiros.',
};