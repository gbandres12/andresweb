import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, TrendingDown, Wallet, ShoppingBag, Package, Users, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format } from 'date-fns';

const MONTHS = ['2026-08', '2026-07', '2026-06', '2026-05', '2026-04'];
const PIE_COLORS = ['#217 27% 17%', '#0 72% 42%', '#142 70% 45%', '217 27% 40%', '35 80% 50%', '280 40% 50%'];
const hsl = c => `hsl(${c})`;

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
const fmtInt = v => (Number(v) || 0).toLocaleString('pt-BR');

export default function Relatorios() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sl, pr, ex, tr] = await Promise.all([
          base44.entities.Sale.list('-created_date', 1000),
          base44.entities.Product.list('-created_date', 1000),
          base44.entities.Expense.filter({ month }, '-created_date', 500),
          base44.entities.Transaction.filter({ month }, '-created_date', 500),
        ]);
        setSales(sl);
        setProducts(pr);
        setExpenses(ex);
        setTransactions(tr);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [month]);

  const monthSales = useMemo(
    () => sales.filter(s => s.status === 'concluida' && (s.created_date || '').slice(0, 7) === month),
    [sales, month]
  );

  const report = useMemo(() => {
    const revenue = monthSales.reduce((s, x) => s + (x.total || 0), 0);
    const itemsSold = monthSales.reduce((s, x) => s + (x.items || []).reduce((a, i) => a + (i.quantity || 0), 0), 0);
    const ticket = monthSales.length ? revenue / monthSales.length : 0;

    // Lucro bruto: soma (preço venda - custo) por item
    let cogs = 0;
    monthSales.forEach(s => {
      (s.items || []).forEach(i => {
        const prod = products.find(p => p.id === i.product_id);
        const cost = prod?.cost_price || 0;
        cogs += cost * (i.quantity || 0);
      });
    });
    const grossProfit = revenue - cogs;

    // Por forma de pagamento
    const byPayment = {};
    monthSales.forEach(s => {
      byPayment[s.payment_method] = (byPayment[s.payment_method] || 0) + (s.total || 0);
    });

    // Por vendedor
    const bySeller = {};
    monthSales.forEach(s => {
      const name = s.seller_name || 'Sem vendedor';
      if (!bySeller[name]) bySeller[name] = { revenue: 0, count: 0 };
      bySeller[name].revenue += s.total || 0;
      bySeller[name].count += 1;
    });

    // Top produtos (quantidade)
    const byProduct = {};
    monthSales.forEach(s => {
      (s.items || []).forEach(i => {
        const key = i.product_name || '—';
        if (!byProduct[key]) byProduct[key] = { name: key, qty: 0, revenue: 0 };
        byProduct[key].qty += i.quantity || 0;
        byProduct[key].revenue += i.total || 0;
      });
    });
    const topProducts = Object.values(byProduct).sort((a, b) => b.qty - a.qty).slice(0, 8);

    // Estoque: valor de custo e de venda
    let stockCost = 0, stockRetail = 0, stockUnits = 0, lowStock = 0;
    products.forEach(p => {
      (p.variants || []).forEach(v => {
        const st = v.stock || 0;
        stockUnits += st;
        stockCost += (p.cost_price || 0) * st;
        stockRetail += (p.price || 0) * st;
        if (st > 0 && st <= 3) lowStock += 1;
      });
    });

    // Despesas
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const fixedExpenses = expenses.filter(e => e.type === 'fixa').reduce((s, e) => s + (e.amount || 0), 0);
    const variableExpenses = expenses.filter(e => e.type === 'variável').reduce((s, e) => s + (e.amount || 0), 0);

    // Resultado líquido: lucro bruto - despesas
    const netResult = grossProfit - totalExpenses;

    return {
      revenue, itemsSold, ticket, count: monthSales.length, grossProfit, cogs,
      byPayment, bySeller, topProducts,
      stockCost, stockRetail, stockUnits, lowStock,
      totalExpenses, fixedExpenses, variableExpenses, netResult,
    };
  }, [monthSales, products, expenses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paymentData = Object.entries(report.byPayment).map(([name, value]) => ({ name, value }));
  const sellerData = Object.entries(report.bySeller).map(([name, v]) => ({ name, ...v }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">Relatório Gerencial</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada de vendas, estoque e resultado</p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ShoppingBag} label="Faturamento" value={fmt(report.revenue)} tone="primary" />
        <KpiCard icon={Receipt} label="Vendas no mês" value={fmtInt(report.count)} sub={`${fmtInt(report.itemsSold)} itens`} />
        <KpiCard icon={Wallet} label="Ticket médio" value={fmt(report.ticket)} />
        <KpiCard
          icon={report.netResult >= 0 ? TrendingUp : TrendingDown}
          label="Resultado líquido"
          value={fmt(report.netResult)}
          tone={report.netResult >= 0 ? 'emerald' : 'red'}
          sub={`Lucro bruto ${fmt(report.grossProfit)}`}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Vendas por vendedor">
          {sellerData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sellerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="revenue" name="Faturamento" fill="hsl(217 27% 17%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>

        <Card title="Formas de pagamento">
          {paymentData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={e => e.name}>
                  {paymentData.map((_, i) => <Cell key={i} fill={hsl(PIE_COLORS[i % PIE_COLORS.length])} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>
      </div>

      {/* Estoque + Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Valor de estoque">
          <div className="space-y-2 text-sm">
            <Row label="Unidades em estoque" value={fmtInt(report.stockUnits)} icon={Package} />
            <Row label="Valor de custo" value={fmt(report.stockCost)} />
            <Row label="Valor de venda" value={fmt(report.stockRetail)} />
            <Row label="Potencial de margem" value={fmt(report.stockRetail - report.stockCost)} tone="emerald" />
            <Row label="Itens com estoque baixo (≤3)" value={fmtInt(report.lowStock)} tone="amber" />
          </div>
        </Card>

        <Card title="Despesas do mês">
          <div className="space-y-2 text-sm">
            <Row label="Despesas fixas" value={fmt(report.fixedExpenses)} />
            <Row label="Despesas variáveis" value={fmt(report.variableExpenses)} />
            <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
              <span>Total</span><span className="tabular-nums">{fmt(report.totalExpenses)}</span>
            </div>
          </div>
        </Card>

        <Card title="Resultado do mês">
          <div className="space-y-2 text-sm">
            <Row label="Faturamento" value={fmt(report.revenue)} />
            <Row label="(-) Custo dos produtos" value={fmt(report.cogs)} tone="red" />
            <Row label="(=) Lucro bruto" value={fmt(report.grossProfit)} tone="emerald" />
            <Row label="(-) Despesas" value={fmt(report.totalExpenses)} tone="red" />
            <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
              <span>Resultado líquido</span>
              <span className={`tabular-nums ${report.netResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(report.netResult)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Top produtos */}
      <Card title="Top produtos vendidos">
        {report.topProducts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 font-medium">Produto</th>
                  <th className="py-2 font-medium text-right">Quantidade</th>
                  <th className="py-2 font-medium text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {report.topProducts.map(p => (
                  <tr key={p.name} className="border-b border-border/60">
                    <td className="py-2 text-foreground">{p.name}</td>
                    <td className="py-2 text-right tabular-nums">{fmtInt(p.qty)}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone = 'default' }) {
  const toneClass = {
    primary: 'text-primary',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
    default: 'text-foreground',
  }[tone];
  return (
    <div className="bg-card border-t-2 border-t-primary/60 border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-serif font-semibold mt-2 tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <h2 className="font-serif text-base font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, icon: Icon, tone }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-foreground';
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </span>
      <span className={`font-medium tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function Empty() {
  return <div className="text-center text-sm text-muted-foreground py-10">Sem dados no período</div>;
}