import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingBag, Package, Users, ArrowRight, AlertTriangle, Star, ChevronDown, Store as StoreIcon, BarChart3, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useStore } from '@/hooks/useStore';

export default function Dashboard() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('vendas');
  const [period, setPeriod] = useState('hoje');
  const { store } = useStore();

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

  // Top selling products (today)
  const topProducts = (() => {
    const map = {};
    todaySales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.product_id;
        if (!map[key]) map[key] = { name: item.product_name, qty: 0, revenue: 0 };
        map[key].qty += item.quantity || 1;
        map[key].revenue += item.total || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  })();

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

  // Period-filtered sales list (existing data, presentation only)
  const periodSales = period === 'hoje' ? todaySales
    : period === 'mes' ? monthSales
    : sales.filter(s => s.status === 'concluida' && new Date(s.created_date) >= subDays(new Date(), 7));
  const periodRevenue = periodSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const periodLabel = period === 'hoje' ? 'Hoje' : period === 'mes' ? 'do Mês' : 'Últimos 7 dias';

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const tabs = [
    { id: 'vendas', label: 'Vendas' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'fiscal', label: 'Fiscal' },
  ];

  return (
    <div className="min-h-full bg-background">
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl lg:text-4xl font-serif font-semibold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Selector bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Loja Ativa:</span>
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm">
              <StoreIcon className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{store?.name || '—'}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Período:</span>
            <div className="relative flex items-center">
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="appearance-none bg-card border border-border rounded-lg pl-3 pr-9 py-2 text-sm font-medium text-foreground outline-none cursor-pointer focus:ring-1 focus:ring-ring"
              >
                <option value="hoje">Hoje</option>
                <option value="mes">Mês</option>
                <option value="7dias">Últimos 7 dias</option>
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground/60 absolute right-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={TrendingUp} label="Vendas Hoje" value={`R$ ${todayRevenue.toFixed(2).replace('.', ',')}`} sub={`${todaySales.length} vendas`} />
          <KpiCard icon={ShoppingBag} label="Vendas do Mês" value={`R$ ${monthRevenue.toFixed(2).replace('.', ',')}`} sub={`${monthSales.length} vendas`} />
          <KpiCard icon={Package} label="Produtos Ativos" value={products.filter(p => p.is_active).length} sub={`${outOfStock.length} sem estoque`} />
          <KpiCard icon={Users} label="Clientes" value={customers.length} sub="cadastrados" />
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: tabs card */}
          <div className="lg:col-span-5 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="flex border-b border-border">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 px-5 py-3.5 text-sm font-sans font-semibold transition-colors ${
                    activeTab === t.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1">
              {activeTab === 'vendas' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-serif font-semibold text-foreground">Vendas {periodLabel}</h2>
                      <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                        {periodSales.length} venda{periodSales.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {periodSales.length === 0 ? (
                      <p className="text-muted-foreground text-sm py-6 text-center">Nenhuma venda registrada no período.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {periodSales.slice(0, 8).map(sale => (
                          <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground text-sm">{sale.customer_name || 'Cliente avulso'}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(sale.created_date), 'HH:mm')} · {sale.payment_method}
                              </span>
                            </div>
                            <span className="font-semibold text-foreground text-sm">
                              R$ {sale.total?.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Faturamento do período</span>
                      <span className="text-lg font-serif font-semibold text-foreground">R$ {periodRevenue.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-serif font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-primary" /> Peças Mais Vendidas Hoje
                    </h2>
                    {topProducts.length === 0 ? (
                      <p className="text-muted-foreground text-sm py-4 text-center">Nenhuma venda registrada hoje.</p>
                    ) : (
                      <div className="space-y-3">
                        {topProducts.map((item, i) => (
                          <div key={item.name} className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            }`}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                              <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round((item.qty / topProducts[0].qty) * 100)}%` }} />
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-foreground">{item.qty} un</p>
                              <p className="text-xs text-muted-foreground">R$ {item.revenue.toFixed(2).replace('.', ',')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link to="/vendas" className="flex items-center gap-1 text-sm text-primary font-medium hover:underline">
                    Ver histórico completo <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {activeTab === 'estoque' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-serif font-semibold text-foreground mb-2">Alertas de Estoque</h2>
                  {outOfStock.length === 0 && lowStock.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-6 text-center">Estoque em dia! ✓</p>
                  ) : (
                    <div className="space-y-2">
                      {outOfStock.slice(0, 6).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-2 border-b border-border/60 last:border-0">
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
                          <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded">Sem estoque</span>
                        </div>
                      ))}
                      {lowStock.slice(0, 6).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-2 border-b border-border/60 last:border-0">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Baixo</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link to="/estoque" className="flex items-center gap-1 text-sm text-primary font-medium hover:underline pt-2">
                    Ver estoque completo <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {activeTab === 'fiscal' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-serif font-semibold text-foreground mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Vendas Recentes
                  </h2>
                  {periodSales.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-6 text-center">Nenhuma venda no período.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {periodSales.slice(0, 12).map(sale => (
                        <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground text-sm">{sale.customer_name || 'Cliente avulso'}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(sale.created_date), 'dd/MM HH:mm')} · {sale.payment_method}</span>
                          </div>
                          <span className="font-semibold text-foreground text-sm">R$ {sale.total?.toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-2">Integração NFC-e para emissão de cupom fiscal disponível em breve.</p>
                </div>
              )}
            </div>
          </div>

          {/* Middle: chart + CTA */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-serif font-semibold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Faturamento — 7 dias
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v) => [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Total']}
                    contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid hsl(var(--border))', fontFamily: 'inherit', background: 'hsl(var(--card))' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <Link
              to="/pdv"
              className="block bg-primary hover:bg-primary/90 transition-colors rounded-xl p-6 shadow-sm group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary-foreground/15 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-sans font-semibold text-primary-foreground">Nova Venda</p>
                  <p className="text-sm text-primary-foreground/80">Abrir caixa</p>
                </div>
                <ArrowRight className="w-5 h-5 text-primary-foreground/80 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          {/* Right: alerts + shortcuts */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
              <h2 className="text-base font-serif font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Alertas de Estoque
              </h2>
              {lowStock.length === 0 && outOfStock.length === 0 ? (
                <p className="text-muted-foreground text-sm">Estoque em dia! ✓</p>
              ) : (
                <div className="space-y-2.5">
                  {outOfStock.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
                      <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded shrink-0">Sem estoque</span>
                    </div>
                  ))}
                  {lowStock.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded shrink-0">Baixo</span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/estoque" className="flex items-center gap-1 text-sm text-primary font-medium hover:underline mt-4 pt-3 border-t border-border/60">
                Ver estoque completo <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
              <h2 className="text-base font-serif font-semibold text-foreground mb-4">Atalhos</h2>
              <div className="space-y-1">
                {[
                  { to: '/produtos', label: 'Produtos', desc: 'Gerenciar catálogo' },
                  { to: '/vendas', label: 'Histórico', desc: 'Ver vendas' },
                  { to: '/catalogo', label: 'Catálogo Online', desc: 'Ver loja pública' },
                ].map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <Icon className="w-5 h-5 text-muted-foreground/60" />
      </div>
      <p className="text-2xl lg:text-3xl font-serif font-semibold text-foreground tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}