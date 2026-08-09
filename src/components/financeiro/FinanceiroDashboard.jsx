import { useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';

export default function FinanceiroDashboard({ sales, expenses, transactions, selectedMonth, onMonthChange }) {
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return format(d, 'yyyy-MM');
  });

  const monthSales = useMemo(() => sales.filter(s => {
    const d = new Date(s.created_date);
    const m = format(d, 'yyyy-MM');
    return s.status === 'concluida' && m === selectedMonth;
  }), [sales, selectedMonth]);

  const monthExpenses = useMemo(() => expenses.filter(e => e.month === selectedMonth), [expenses, selectedMonth]);

  const monthTransactions = useMemo(() => transactions.filter(t => t.month === selectedMonth), [transactions, selectedMonth]);

  const revenue = monthSales.reduce((s, sale) => s + (sale.total || 0), 0);
  const extraRevenue = monthTransactions.filter(t => t.type === 'receita' && t.status === 'pago').reduce((s, t) => s + (t.amount || 0), 0);
  const totalRevenue = revenue + extraRevenue;

  const totalExpenses = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const extraExpenses = monthTransactions.filter(t => t.type === 'despesa' && t.status === 'pago').reduce((s, t) => s + (t.amount || 0), 0);
  const totalCosts = totalExpenses + extraExpenses;

  const netProfit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const pending = transactions.filter(t => t.status === 'pendente');
  const pendingReceivable = pending.filter(t => t.type === 'receita').reduce((s, t) => s + (t.amount || 0), 0);
  const pendingPayable = pending.filter(t => t.type === 'despesa').reduce((s, t) => s + (t.amount || 0), 0);

  // 6-month chart data
  const chartData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const m = format(subMonths(new Date(), 5 - i), 'yyyy-MM');
    const label = format(subMonths(new Date(), 5 - i), 'MMM', { locale: ptBR });
    const r = sales.filter(s => s.status === 'concluida' && format(new Date(s.created_date), 'yyyy-MM') === m)
      .reduce((s, sale) => s + (sale.total || 0), 0);
    const rExtra = transactions.filter(t => t.type === 'receita' && t.status === 'pago' && t.month === m)
      .reduce((s, t) => s + (t.amount || 0), 0);
    const d = expenses.filter(e => e.month === m).reduce((s, e) => s + (e.amount || 0), 0);
    const dExtra = transactions.filter(t => t.type === 'despesa' && t.status === 'pago' && t.month === m)
      .reduce((s, t) => s + (t.amount || 0), 0);
    return { label, receita: r + rExtra, despesa: d + dExtra };
  }), [sales, expenses, transactions]);

  // Top expense categories
  const expenseByCategory = useMemo(() => {
    const map = {};
    monthExpenses.forEach(e => {
      const cat = e.category || 'Outros';
      map[cat] = (map[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [monthExpenses]);

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Período:</span>
        <Select value={selectedMonth} onValueChange={onMonthChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => (
              <SelectItem key={m} value={m}>
                {format(new Date(m + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="Receita Total"
          value={totalRevenue}
          sub={`${monthSales.length} vendas`}
          color="green"
        />
        <KpiCard
          icon={TrendingDown}
          label="Despesas Totais"
          value={totalCosts}
          sub={`${monthExpenses.length} lançamentos`}
          color="red"
        />
        <div className={cn(
          "rounded-2xl border p-4 shadow-sm",
          netProfit >= 0 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900" : "bg-destructive/10 border-destructive/20"
        )}>
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2",
            netProfit >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" : "bg-destructive/20 text-destructive"
          )}>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className={cn("text-xl font-serif font-semibold", netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
            R$ {Math.abs(netProfit).toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Lucro Líquido</p>
          <p className={cn("text-xs font-medium mt-1", netProfit >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-destructive")}>
            {netProfit < 0 ? '⚠ Prejuízo' : `Margem: ${margin.toFixed(1)}%`}
          </p>
        </div>
        <KpiCard
          icon={AlertCircle}
          label="A Receber"
          value={pendingReceivable}
          sub={`A pagar: R$ ${pendingPayable.toFixed(2)}`}
          color="orange"
        />
      </div>

      {/* Chart + Category breakdown */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-card shadow-sm rounded-2xl border border-slate-200 dark:border-border p-5">
          <h3 className="font-serif text-base font-semibold mb-4 text-slate-900 dark:text-slate-100">Receitas vs Despesas (6 meses)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(val) => [`R$ ${val.toFixed(2)}`, '']} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita" fill="#059669" radius={[4,4,0,0]} />
              <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-card shadow-sm rounded-2xl border border-slate-200 dark:border-border p-5">
          <h3 className="font-serif text-base font-semibold mb-4 text-slate-900 dark:text-slate-100">Top Despesas por Categoria</h3>
          {expenseByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem despesas no mês</p>
          ) : (
            <div className="space-y-3">
              {expenseByCategory.map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{cat}</span>
                    <span className="font-medium">R$ {val.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min((val / totalCosts) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400 shadow-sm',
    red: 'bg-destructive/10 border-destructive/20 text-destructive shadow-sm',
    orange: 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950/30 dark:border-orange-900 dark:text-orange-400 shadow-sm',
  };
  const iconColors = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
    red: 'bg-destructive/20 text-destructive',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400',
  };
  return (
    <div className={cn("rounded-2xl border p-4", colors[color])}>
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2", iconColors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl font-serif font-semibold">R$ {value.toFixed(2).replace('.', ',')}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}