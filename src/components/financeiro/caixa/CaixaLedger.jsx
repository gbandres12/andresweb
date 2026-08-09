import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lock, ShoppingBag, ArrowUpCircle, ArrowDownCircle, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/StoreContext';
import { printControlCupom } from '@/components/pdv/ControlCupom';

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
const normMethod = m =>
  (m === 'Dinheiro' || m === 'PIX') ? m
  : (m && m.startsWith('Cartão') ? 'Cartão'
  : (m === 'Consignação' ? 'Consignado' : null));

const typeBadge = (t) => {
  if (t === 'abertura') return { cls: 'bg-blue-50 text-blue-600', icon: Lock, label: 'Abertura' };
  if (t === 'venda') return { cls: 'bg-emerald-50 text-emerald-600', icon: ShoppingBag, label: 'Venda' };
  if (t === 'suprimento') return { cls: 'bg-green-50 text-green-600', icon: ArrowUpCircle, label: 'Suprimento' };
  return { cls: 'bg-red-50 text-red-600', icon: ArrowDownCircle, label: 'Sangria' };
};

export default function CaixaLedger({ register, movements, sales }) {
  const { store } = useStore();

  const ledger = useMemo(() => {
    if (!register) return [];
    const openedAt = register.opened_at ? new Date(register.opened_at) : null;
    const closedAt = register.closed_at ? new Date(register.closed_at) : null;
    const events = [{
      date: openedAt || new Date(0),
      type: 'abertura', label: 'Abertura de Caixa', method: 'Dinheiro',
      in: register.opening_balance || 0, out: 0,
      saleObj: null,
    }];
    (sales || []).forEach(s => {
      const dt = new Date(s.created_date);
      if (openedAt && dt < openedAt) return;
      if (closedAt && dt > closedAt) return;
      const m = normMethod(s.payment_method);
      events.push({
        date: dt, type: 'venda',
        label: `Venda${s.sale_number ? ' ' + s.sale_number : ''}`,
        method: m || s.payment_method, in: s.total || 0, out: 0,
        extra: s.seller_name,
        saleNumber: s.sale_number,
        customerName: s.customer_name,
        saleObj: s,
      });
    });
    (movements || []).forEach(mv => {
      events.push({
        date: new Date(mv.created_date), type: mv.type,
        label: mv.description || (mv.type === 'sangria' ? 'Sangria' : 'Suprimento'),
        method: mv.payment_method,
        in: mv.type === 'suprimento' ? (mv.amount || 0) : 0,
        out: mv.type === 'sangria' ? (mv.amount || 0) : 0,
        extra: mv.operator_name,
        saleObj: null,
      });
    });
    events.sort((a, b) => a.date - b.date);
    let bal = 0;
    return events.map(e => { bal += (e.in - e.out); return { ...e, balance: bal }; });
  }, [register, movements, sales]);

  if (!register) return null;
  const totals = ledger.reduce((a, e) => ({ in: a.in + e.in, out: a.out + e.out }), { in: 0, out: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-700/80 mb-1">Entradas</p>
          <p className="text-lg font-serif font-semibold tabular-nums text-green-700">{fmt(totals.in)}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-700/80 mb-1">Saídas</p>
          <p className="text-lg font-serif font-semibold tabular-nums text-red-600">{fmt(totals.out)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Saldo final</p>
          <p className="text-lg font-serif font-semibold tabular-nums">{fmt(ledger.length ? ledger[ledger.length - 1].balance : register.opening_balance || 0)}</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-serif text-base font-semibold">Movimentações do dia</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ordem cronológica com saldo acumulado · Clique na impressora para emitir cupom</p>
        </div>
        {ledger.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-sm">Nenhuma movimentação registrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Forma</th>
                  <th className="px-4 py-3">Data/Hora</th>
                  <th className="px-4 py-3 text-right">Entrada</th>
                  <th className="px-4 py-3 text-right">Saída</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                  <th className="px-3 py-3 text-center">Cupom</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e, i) => {
                  const badge = typeBadge(e.type);
                  const Icon = badge.icon;
                  return (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium', badge.cls)}>
                          <Icon className="w-3 h-3" /> {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          {e.type === 'venda' && e.saleNumber ? (
                            <span className="font-medium text-primary">{e.label}</span>
                          ) : (
                            e.label
                          )}
                          {e.customerName && (
                            <span className="block text-xs text-muted-foreground">Cliente: {e.customerName}</span>
                          )}
                          {e.extra && !e.customerName && (
                            <span className="block text-xs text-muted-foreground">{e.extra}</span>
                          )}
                          {e.extra && e.customerName && (
                            <span className="block text-xs text-muted-foreground">Vendedor: {e.extra}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{e.method || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{format(e.date, "dd/MM HH:mm", { locale: ptBR })}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-green-600">{e.in > 0 ? fmt(e.in) : '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-red-600">{e.out > 0 ? fmt(e.out) : '—'}</td>
                      <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums">{fmt(e.balance)}</td>
                      <td className="px-3 py-3 text-center">
                        {e.type === 'venda' && e.saleObj ? (
                          <button
                            onClick={() => printControlCupom(e.saleObj, store)}
                            title={`Imprimir cupom ${e.saleNumber || ''}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}