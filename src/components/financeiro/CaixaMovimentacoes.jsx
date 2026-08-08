import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, ArrowDownCircle, ArrowUpCircle, ShoppingBag, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
const normMethod = m => (m === 'Dinheiro' || m === 'PIX') ? m : (m && m.startsWith('Cartão') ? 'Cartão' : null);

export default function CaixaMovimentacoes() {
  const { store } = useStore();
  const [register, setRegister] = useState(null);
  const [movements, setMovements] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const regs = await base44.entities.CashRegister.list('-opened_at', 50);
        const reg = regs[0] || null;
        setRegister(reg);
        if (reg) {
          const [movs, sls] = await Promise.all([
            base44.entities.CashMovement.filter({ register_id: reg.id }, '-created_date', 1000),
            base44.entities.Sale.filter({ status: 'concluida' }, '-created_date', 1000),
          ]);
          setMovements(movs || []);
          setSales(sls || []);
        }
      } catch {
        setRegister(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ledger = useMemo(() => {
    if (!register) return [];
    const openedAt = register.opened_at ? new Date(register.opened_at) : null;
    const closedAt = register.closed_at ? new Date(register.closed_at) : null;
    const events = [];

    events.push({
      date: openedAt || new Date(0),
      type: 'abertura', label: 'Abertura de Caixa', method: 'Dinheiro',
      in: register.opening_balance || 0, out: 0,
    });

    (sales || []).forEach(s => {
      const dt = new Date(s.created_date);
      if (openedAt && dt < openedAt) return;
      if (closedAt && dt > closedAt) return;
      const m = normMethod(s.payment_method);
      if (!m) return;
      events.push({
        date: dt, type: 'venda',
        label: `Venda${s.sale_number ? ' ' + s.sale_number : ''}`,
        method: m, in: s.total || 0, out: 0, extra: s.seller_name,
      });
    });

    (movements || []).forEach(mv => {
      events.push({
        date: new Date(mv.created_date),
        type: mv.type,
        label: mv.description || (mv.type === 'sangria' ? 'Sangria' : 'Suprimento'),
        method: mv.payment_method,
        in: mv.type === 'suprimento' ? (mv.amount || 0) : 0,
        out: mv.type === 'sangria' ? (mv.amount || 0) : 0,
        extra: mv.operator_name,
      });
    });

    events.sort((a, b) => a.date - b.date);
    let bal = 0;
    return events.map(e => { bal += (e.in - e.out); return { ...e, balance: bal }; });
  }, [register, movements, sales]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!register) {
    return (
      <div className="bg-card rounded-2xl border border-border p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <Wallet className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="font-serif text-xl font-semibold">Nenhum caixa encontrado</h3>
        <p className="text-sm text-muted-foreground mt-1">Abra um caixa na aba "Caixa" para registrar movimentações.</p>
      </div>
    );
  }

  const totals = ledger.reduce((a, e) => ({ in: a.in + e.in, out: a.out + e.out }), { in: 0, out: 0 });
  const isOpen = register.status === 'aberto';

  const typeBadge = (t) => {
    if (t === 'abertura') return { cls: 'bg-blue-50 text-blue-600', icon: Lock, label: 'Abertura' };
    if (t === 'venda') return { cls: 'bg-emerald-50 text-emerald-600', icon: ShoppingBag, label: 'Venda' };
    if (t === 'suprimento') return { cls: 'bg-green-50 text-green-600', icon: ArrowUpCircle, label: 'Suprimento' };
    return { cls: 'bg-red-50 text-red-600', icon: ArrowDownCircle, label: 'Sangria' };
  };

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isOpen ? "bg-green-100" : "bg-muted")}>
            <Wallet className={cn("w-5 h-5", isOpen ? "text-green-700" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="font-serif text-lg font-semibold">Caixa {isOpen ? 'Aberto' : 'Fechado'}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(register.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {register.closed_at && ` · fechado ${format(new Date(register.closed_at), "dd/MM HH:mm", { locale: ptBR })}`}
              {register.opened_by_name ? ` · ${register.opened_by_name}` : ''}
            </p>
          </div>
        </div>
        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", isOpen ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
          {isOpen ? 'Aberto' : 'Fechado'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="rounded-2xl border border-border bg-primary text-primary-foreground p-4">
          <p className="text-xs opacity-80 mb-1">Movimentações</p>
          <p className="text-lg font-serif font-semibold tabular-nums">{ledger.length}</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-serif text-base font-semibold">Todas as movimentações</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ordem cronológica com saldo acumulado</p>
        </div>
        {ledger.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-sm">Nenhuma movimentação registrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Forma</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Data/Hora</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Entrada</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Saída</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo</th>
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
                        {e.label}
                        {e.extra && <span className="block text-xs text-muted-foreground">{e.extra}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{e.method || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{format(e.date, "dd/MM HH:mm", { locale: ptBR })}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-green-600">{e.in > 0 ? fmt(e.in) : '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-red-600">{e.out > 0 ? fmt(e.out) : '—'}</td>
                      <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums">{fmt(e.balance)}</td>
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