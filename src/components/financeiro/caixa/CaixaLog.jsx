import { useState, useEffect, Fragment } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronRight, ChevronDown, Wallet, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
const nf = v => (Number(v) || 0).toFixed(2).replace('.', ',');

const METHODS = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'pix', label: 'PIX' },
  { key: 'cartao', label: 'Cartão' },
  { key: 'consignado', label: 'Consignado' },
];

export default function CaixaLog() {
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setRegs((await base44.entities.CashRegister.list('-opened_at', 100)) || []); }
      catch { setRegs([]); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!regs.length) return (
    <div className="bg-card rounded-2xl border border-border p-10 text-center">
      <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Nenhum caixa registrado ainda.</p>
    </div>
  );

  const diffOf = (r, key) => (Number(r[`counted_${key}`]) || 0) - (Number(r[`expected_${key}`]) || 0);
  const totalDiff = r => METHODS.reduce((s, m) => s + diffOf(r, m.key), 0);
  const countedTotal = r => METHODS.reduce((s, m) => s + (Number(r[`counted_${m.key}`]) || 0), 0);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-serif text-base font-semibold">Histórico de Caixas</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Abertura, esperado vs. contado e diferenças por forma — acesso do gerente.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Aberto por</th>
              <th className="px-4 py-3 text-right">Abertura</th>
              <th className="px-4 py-3">Fechado por</th>
              <th className="px-4 py-3 text-right">Contado</th>
              <th className="px-4 py-3 text-right">Diferença</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {regs.map(r => {
              const isOpen = r.status === 'aberto';
              const diff = totalDiff(r);
              const hasDiff = Math.abs(diff) >= 0.005;
              const expanded = openId === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => setOpenId(expanded ? null : r.id)}>
                    <td className="px-4 py-3 text-muted-foreground">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                    <td className="px-4 py-3 text-sm">{r.opened_at ? format(new Date(r.opened_at), "dd/MM/yyyy", { locale: ptBR }) : '—'}</td>
                    <td className="px-4 py-3 text-sm">{r.opened_by_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{fmt(r.opening_balance || 0)}</td>
                    <td className="px-4 py-3 text-sm">{!isOpen && r.closed_by_name ? r.closed_by_name : '—'}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{!isOpen ? fmt(countedTotal(r)) : '—'}</td>
                    <td className={cn('px-4 py-3 text-sm text-right tabular-nums font-medium', isOpen ? 'text-muted-foreground' : (hasDiff ? 'text-amber-600' : 'text-green-600'))}>
                      {isOpen ? '—' : hasDiff ? `${diff > 0 ? '+' : ''}${nf(diff)}` : 'ok'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', isOpen ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>
                        {isOpen ? 'Aberto' : 'Fechado'}
                      </span>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-muted/20">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Detalhamento por forma</p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-muted-foreground">
                                  <th className="text-left py-1">Forma</th>
                                  <th className="text-right py-1">Esperado</th>
                                  <th className="text-right py-1">Contado</th>
                                  <th className="text-right py-1">Diferença</th>
                                </tr>
                              </thead>
                              <tbody>
                                {METHODS.map(m => {
                                  const d = diffOf(r, m.key);
                                  return (
                                    <tr key={m.key} className="border-t border-border">
                                      <td className="py-1.5">{m.label}</td>
                                      <td className="py-1.5 text-right tabular-nums">{fmt(r[`expected_${m.key}`] || 0)}</td>
                                      <td className="py-1.5 text-right tabular-nums">{isOpen ? '—' : fmt(r[`counted_${m.key}`] || 0)}</td>
                                      <td className={cn('py-1.5 text-right tabular-nums font-medium', isOpen ? 'text-muted-foreground' : (Math.abs(d) >= 0.005 ? 'text-amber-600' : 'text-green-600'))}>
                                        {isOpen ? '—' : Math.abs(d) < 0.005 ? 'ok' : `${d > 0 ? '+' : ''}${nf(d)}`}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div><span className="text-muted-foreground">Abertura: </span>{r.opened_at ? format(new Date(r.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}</div>
                            <div><span className="text-muted-foreground">Fechamento: </span>{r.closed_at ? format(new Date(r.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}</div>
                            {r.notes && <div className="flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><span className="text-foreground">{r.notes}</span></div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}