import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingBag, Package, Users, ArrowRight, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Sale.list('-created_date', 200),
      base44.entities.Product.list(),
      base44.entities.Customer.list(),
    ]).then(([s, p, c]) => {
      setSales(s);
      setProducts(p);
      setCustomers(c);
      setLoading(false);
    });
  }, []);

  const today = startOfDay(new Date());
  const todaySales = sales.filter(s => s.status === 'concluida' && new Date(s.created_date) >= today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const monthSales = sales.filter(s => {
    const d = new Date(s.created_date);
    const now = new Date();
    return s.status === 'concluida' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);

  // Low stock products
  const lowStock = products.filter(p => 
    p.variants?.some(v => v.stock <= 3 && v.stock > 0)
  );
  const outOfStock = products.filter(p => 
    p.variants?.every(v => v.stock === 0) || (!p.variants?.length)
  );

  // Chart: last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const daySales = sales.filter(s => {
      const d = new Date(s.created_date);
      return s.status === 'concluida' && d >= dayStart && d < dayEnd;
    });
    return {
      day: format(day, 'EEE', { locale: ptBR }),
      total: daySales.reduce((sum, s) => sum + (s.total || 0), 0),
    };
  });

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Vendas Hoje" value={`R$ ${todayRevenue.toFixed(2)}`} sub={`${todaySales.length} vendas`} color="primary" />
        <StatCard icon={ShoppingBag} label="Vendas do Mês" value={`R$ ${monthRevenue.toFixed(2)}`} sub={`${monthSales.length} vendas`} color="rose" />
        <StatCard icon={Package} label="Produtos Ativos" value={products.filter(p => p.is_active).length} sub={`${outOfStock.length} sem estoque`} color="amber" />
        <StatCard icon={Users} label="Clientes" value={customers.length} sub="cadastrados" color="slate" />
      </div>

      {/* Chart + Alerts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
          <h2 className="font-serif text-lg font-semibold mb-4">Faturamento — 7 dias</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontFamily: 'Jost' }} />
              <YAxis hide />
              <Tooltip 
                formatter={(v) => [`R$ ${v.toFixed(2)}`, 'Total']}
                contentStyle={{ fontFamily: 'Jost', fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Alertas de Estoque</h2>
          {lowStock.length === 0 && outOfStock.length === 0 ? (
            <p className="text-muted-foreground text-sm">Estoque em dia! ✓</p>
          ) : (
            <div className="space-y-2">
              {outOfStock.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <span className="text-foreground truncate">{p.name}</span>
                  <span className="ml-auto text-destructive text-xs font-medium">Sem estoque</span>
                </div>
              ))}
              {lowStock.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-foreground truncate">{p.name}</span>
                  <span className="ml-auto text-amber-500 text-xs font-medium">Baixo</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/estoque" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
            Ver estoque completo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: '/pdv', label: 'Nova Venda', desc: 'Abrir caixa' },
          { to: '/produtos', label: 'Produtos', desc: 'Gerenciar catálogo' },
          { to: '/vendas', label: 'Histórico', desc: 'Ver vendas' },
          { to: '/catalogo', label: 'Catálogo Online', desc: 'Ver loja pública' },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
          >
            <p className="font-sans font-medium text-sm text-foreground group-hover:text-primary transition-colors">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    primary: 'bg-accent text-primary',
    rose: 'bg-pink-50 text-pink-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-serif font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 font-sans">{label}</p>
      <p className="text-xs text-muted-foreground font-sans">{sub}</p>
    </div>
  );
}