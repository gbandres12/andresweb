import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Save, RefreshCw, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useStore } from '@/lib/StoreContext';
import { DEFAULT_TABLES_CONFIG, PAYMENT_METHODS, getStoreTables, fmtPct } from '@/lib/priceTables';
import { cn } from '@/lib/utils';

export default function TabelaPrecoManager() {
  const { store, reload } = useStore();
  const { toast } = useToast();
  const [config, setConfig] = useState(DEFAULT_TABLES_CONFIG.map(t => ({ ...t })));
  const [basePreview, setBasePreview] = useState(100);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [count, setCount] = useState(null);

  useEffect(() => { setConfig(getStoreTables(store)); }, [store]);

  useEffect(() => {
    base44.entities.Product.list('-updated_date', 1).then(r => setCount(r?.length ?? null)).catch(() => {});
  }, []);

  const update = (key, field, val) => {
    setConfig(prev => prev.map(t => t.key === key
      ? { ...t, [field]: field === 'adjustment' ? (val === '' ? '' : Number(val)) : val }
      : t));
  };

  const dirty = JSON.stringify(config) !== JSON.stringify(getStoreTables(store));

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = config.map(t => ({
        key: t.key,
        name: (t.name || '').trim() || t.key,
        payment_method: t.payment_method || 'Dinheiro',
        adjustment: Number(t.adjustment) || 0,
      }));
      const defaultsMap = {};
      cleaned.forEach(c => { defaultsMap[c.key] = c.adjustment; });
      const settings = { ...(store?.settings || {}), price_tables_config: cleaned, price_tables_defaults: defaultsMap };
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
      const map = {};
      config.forEach(t => { map[t.key] = Number(t.adjustment) || 0; });
      const updates = products.map(p => ({ id: p.id, price_tables: { ...map } }));
      await base44.entities.Product.bulkUpdate(updates);
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
              Cada tabela é vinculada a uma forma de pagamento. Edite o nome, a forma de pagamento e o ajuste percentual sobre o preço base.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={applyToAll} disabled={applying}>
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Aplicar a todos os produtos
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar tabelas
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tabela</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preço base</span>
            <Input type="number" min="0" step="0.01" value={basePreview} onChange={e => setBasePreview(Number(e.target.value) || 0)} className="h-7 w-24 text-right tabular-nums" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {config.map(t => {
            const v = Number(t.adjustment) || 0;
            return (
              <div key={t.key} className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 px-5 py-4">
                <div className="sm:col-span-4 space-y-1.5">
                  <Input value={t.name} onChange={e => update(t.key, 'name', e.target.value)} className="h-9 font-medium" placeholder="Nome da tabela" />
                  <Select value={t.payment_method} onValueChange={val => update(t.key, 'payment_method', val)}>
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3 flex items-center gap-2">
                  <Input type="number" step="0.5" value={t.adjustment} onChange={e => update(t.key, 'adjustment', e.target.value)} className="h-9 w-24 tabular-nums" />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
                <div className="sm:col-span-5 flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Ajuste</p>
                    <p className={cn('text-sm font-medium tabular-nums', v < 0 ? 'text-destructive' : v > 0 ? 'text-green-600' : 'text-muted-foreground')}>{fmtPct(v)}</p>
                  </div>
                  <div className="h-8 w-px bg-border hidden sm:block" />
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Preço final</p>
                    <p className="text-sm font-serif font-semibold tabular-nums text-foreground">R$ {eff(v).toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: o preço base fica no cadastro de cada produto. Em "Produtos" você escolhe em quais tabelas cada produto participa.
        {count !== null && <> Atualmente você tem <strong className="text-foreground">{count}</strong> {count === 1 ? 'produto cadastrado' : 'produtos cadastrados'}.</>}
      </p>
    </div>
  );
}