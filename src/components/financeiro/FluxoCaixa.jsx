import { useMemo } from 'react';
import { format, subMonths, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function FluxoCaixa({ sales, expenses, transactions }) {
  const currentMonth = format(new Date(), 'yyyy-MM');

  // Daily cash flow for current month
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    });

    let accumulated = 0;
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'dd/MM');

      const dayRevenue = sales
        .filter(s => s.status === 'concluida' && s.created_date?.startsWith(dayStr))
        .reduce((s, sale) => s + (sale.total || 0), 0);

      const dayExtraRevenue = transactions
        .filter(t => t.type === 'receita' && t.status === 'pago' && (t.paid_date === dayStr || (!t.paid_date && t.created_date?.startsWith(dayStr))))
        .reduce((s, t) => s + (t.amount || 0), 0);

      const dayExpenses = transactions
        .filter(t => t.type === 'despesa' && t.status === 'pago' && (t.paid_date === dayStr || (!t.paid_date && t.created_date?.startsWith(dayStr))))
        .reduce((s, t) => s + (t.amount || 0), 0);

      const net = dayRevenue + dayExtraRevenue - dayExpenses;
      accumulated += net;

      return {
        label: dayLabel,
        entrada: dayRevenue + dayExtraRevenue,
        saida: dayExpenses,
        saldo: accumulated,
      };
    });
  }, [sales, expenses, transactions]);

  // Monthly summary last 6 months
  const monthlyData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const m = format(subMonths(new Date(), 5 - i), 'yyyy-MM');
    const label = format(subMonths(new Date(), 5 - i), "MMM/yy", { locale: ptBR });

    const entrada = sales
      .filter(s => s.status === 'concluida' && format(new Date(s.created_date), 'yyyy-MM') === m)
      .reduce((s, sale) => s + (sale.total || 0), 0)
      + transactions
        .filter(t => t.type === 'receita' && t.status === 'pago' && t.month === m)
        .reduce((s, t) => s + (t.amount || 0), 0);

    const saida = expenses.filter(e => e.month === m).reduce((s, e) => s + (e.amount || 0), 0)
      + transactions.filter(t => t.type === 'despesa' && t.status === 'pago' && t.month === m)
        .reduce((s, t) => s + (t.amount || 0), 0);

    return { label, entrada, saida, saldo: entrada - saida };
  }), [sales, expenses, transactions]);

  return (
    <div className="space-y-6">
      {/* Daily */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-serif text-base font-semibold mb-1">Fluxo Diário — {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</h3>
        <p className="text-xs text-muted-foreground mb-4">Saldo acumulado ao longo do mês atual</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v.toFixed(0)}`} />
            <Tooltip formatter={(val, name) => [`R$ ${val.toFixed(2)}`, name === 'saldo' ? 'Saldo acumulado' : name === 'entrada' ? 'Entradas' : 'Saídas']} />
            <Line dataKey="entrada" name="entrada" stroke="hsl(142,71%,45%)" strokeWidth={1.5} dot={false} />
            <Line dataKey="saida" name="saida" stroke="hsl(0,72%,51%)" strokeWidth={1.5} dot={false} />
            <Line dataKey="saldo" name="saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly summary table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-serif text-base font-semibold">Resumo Mensal (6 meses)</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Mês</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Entradas</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Saídas</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3 text-sm font-medium capitalize">{row.label}</td>
                <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">R$ {row.entrada.toFixed(2).replace('.', ',')}</td>
                <td className="px-4 py-3 text-sm text-right text-destructive font-medium">R$ {row.saida.toFixed(2).replace('.', ',')}</td>
                <td className={`px-4 py-3 text-sm text-right font-semibold font-serif ${row.saldo >= 0 ? 'text-green-700' : 'text-destructive'}`}>
                  {row.saldo < 0 ? '-' : ''}R$ {Math.abs(row.saldo).toFixed(2).replace('.', ',')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}