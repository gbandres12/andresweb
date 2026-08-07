import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function ComissoesManager() {
  const { store, reload } = useStore();
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cfg = store?.settings?.commission || { base: 'faturamento', default_rate: 0, sellers: {} };
  const [base, setBase] = useState(cfg.base);
  const [defaultRate, setDefaultRate] = useState(cfg.default_rate ?? 0);
  const [sellers, setSellers] = useState(
    Object.entries(cfg.sellers || {}).map(([name, rate]) => ({ name, rate }))
  );
  const [newSeller, setNewSeller] = useState('');
  const [newRate, setNewRate] = useState('');
  const [bloquear, setBloquear] = useState(!!store?.settings?.bloquear_inadimplente);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCommissions(await base44.entities.Commission.list('-created_date', 500));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const addSeller = () => {
    if (!newSeller.trim()) return;
    setSellers(s => [...s, { name: newSeller.trim(), rate: Number(newRate) || 0 }]);
    setNewSeller(''); setNewRate('');
  };
  const removeSeller = (i) => setSellers(s => s.filter((_, idx) => idx !== i));

  const saveConfig = async () => {
    setSaving(true);
    try {
      const sellersObj = {};
      sellers.forEach(s => { if (s.name) sellersObj[s.name] = Number(s.rate) || 0; });
      await base44.entities.Store.update(store.id, {
        settings: {
          ...(store.settings || {}),
          commission: { base, default_rate: Number(defaultRate) || 0, sellers: sellersObj },
          bloquear_inadimplente: bloquear,
        },
      });
      toast.success('Regras salvas');
      await reload();
    } catch {
      toast.error('Erro ao salvar regras');
    } finally { setSaving(false); }
  };

  const markPaid = async (c) => {
    await base44.entities.Commission.update(c.id, { status: 'paga', paid_date: format(new Date(), 'yyyy-MM-dd') });
    load();
  };

  const totalPendente = commissions.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.amount || 0), 0);
  const totalPago = commissions.filter(c => c.status === 'paga').reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Configuração */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-serif text-lg font-semibold">Regras de Comissionamento e Bloqueio</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Base de cálculo</label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="faturamento">Faturamento (venda)</SelectItem>
                <SelectItem value="liquidacao">Liquidação (pagamento efetivo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Comissão padrão (%)</label>
            <Input type="number" step="0.1" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Comissão por vendedor (%)</label>
          <div className="space-y-2">
            {sellers.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={s.name} onChange={e => setSellers(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} className="flex-1" placeholder="Vendedor" />
                <Input type="number" step="0.1" value={s.rate} onChange={e => setSellers(prev => prev.map((x, idx) => idx === i ? { ...x, rate: Number(e.target.value) } : x))} className="w-24" placeholder="%" />
                <button onClick={() => removeSeller(i)} className="text-muted-foreground hover:text-destructive p-1.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 items-center">
              <Input value={newSeller} onChange={e => setNewSeller(e.target.value)} className="flex-1" placeholder="Novo vendedor" />
              <Input type="number" step="0.1" value={newRate} onChange={e => setNewRate(e.target.value)} className="w-24" placeholder="%" />
              <Button type="button" variant="outline" size="sm" onClick={addSeller}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={bloquear} onChange={e => setBloquear(e.target.checked)} className="rounded" />
          <span className="text-sm">Bloquear vendas para clientes com títulos vencidos (inadimplência)</span>
        </label>

        <Button onClick={saveConfig} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Regras'}</Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Comissões a pagar</p>
          <p className="text-xl font-serif font-semibold text-amber-700">{fmt(totalPendente)}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Comissões pagas</p>
          <p className="text-xl font-serif font-semibold text-green-700">{fmt(totalPago)}</p>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Venda</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Base</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Taxa</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Comissão</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {commissions.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 text-sm font-medium">{c.sale_number || '—'}</td>
                  <td className="px-4 py-3 text-sm">{c.seller_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    {c.base_type === 'faturamento' ? 'Faturamento' : 'Liquidação'}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums">{(c.rate || 0).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{fmt(c.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-1 rounded-full font-medium', c.status === 'paga' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.status === 'pendente' && (
                      <button onClick={() => markPaid(c)} className="p-1.5 rounded-lg hover:bg-green-100 text-muted-foreground hover:text-green-600">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">Nenhuma comissão registrada</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}