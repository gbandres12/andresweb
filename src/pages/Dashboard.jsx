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
    <div className="flex items-center justify-center h-full bg-slate-900">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  const tabs = [
    { id: 'vendas', label: 'Vendas' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'fiscal', label: 'Fiscal' },
  ];

  return (
    <div className="min-h-full bg-slate-900 text-slate-100">
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Selector bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Loja Ativa:</span>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <StoreIcon className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-white">{store?.name || '—'}</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Período:</span>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="bg-transparent text-white font-medium outline-none cursor-pointer pr-6 -mr-2 appearance-none"
              >
                <option value="hoje" className="bg-slate-800">Hoje</option>
                <option value="mes" className="bg-slate-800">Mês</option>
                <option value="7dias" className="bg-slate-800">Últimos 7 dias</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 -ml-5 pointer-events-none" />
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
          <div className="lg:col-span-5 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="flex border-b border-slate-200">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 px-5 py-3.5 text-sm font-semibold transition-colors ${
                    activeTab === t.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
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
                      <h2 className="text-lg font-bold text-slate-800">Vendas {periodLabel}</h2>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                        {periodSales.length} venda{periodSales.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {periodSales.length === 0 ? (
                      <p className="text-slate-400 text-sm py-6 text-center">Nenhuma venda registrada no período.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {periodSales.slice(0, 8).map(sale => (
                          <div key={sale.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800 text-sm">{sale.customer_name || 'Cliente avulso'}</span>
                              <span className="text-xs text-slate-400">
                                {format(new Date(sale.created_date), 'HH:mm')} · {sale.payment_method}
                              </span>
                            </div>
                            <span className="font-bold text-slate-800 text-sm">
                              R$ {sale.total?.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm text-slate-500">Faturamento do período</span>
                      <span className="text-lg font-bold text-slate-800">R$ {periodRevenue.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-slate-700" /> Peças Mais Vendidas Hoje
                    </h2>
                    {topProducts.length === 0 ? (
                      <p className="text-slate-400 text-sm py-4 text-center">Nenhuma venda registrada hoje.</p>
                    ) : (
                      <div className="space-y-3">
                        {topProducts.map((item, i) => (
                          <div key={item.name} className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              i === 0 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                              <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                                <div className="h-1.5 rounded-full bg-slate-700" style={{ width: `${Math.round((item.qty / topProducts[0].qty) * 100)}%` }} />
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-slate-800">{item.qty} un</p>
                              <p className="text-xs text-slate-400">R$ {item.revenue.toFixed(2).replace('.', ',')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link to="/vendas" className="flex items-center gap-1 text-sm text-slate-700 font-medium hover:underline">
                    Ver histórico completo <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {activeTab === 'estoque' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-slate-800 mb-2">Alertas de Estoque</h2>
                  {outOfStock.length === 0 && lowStock.length === 0 ? (
                    <p className="text-slate-400 text-sm py-6 text-center">Estoque em dia! ✓</p>
                  ) : (
                    <div className="space-y-2">
                      {outOfStock.slice(0, 6).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="text-sm text-slate-800 truncate flex-1">{p.name}</span>
                          <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded">Sem estoque</span>
                        </div>
                      ))}
                      {lowStock.slice(0, 6).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-sm text-slate-800 truncate flex-1">{p.name}</span>
                          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Baixo</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link to="/estoque" className="flex items-center gap-1 text-sm text-slate-700 font-medium hover:underline pt-2">
                    Ver estoque completo <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {activeTab === 'fiscal' && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-700" /> Vendas Recentes
                  </h2>
                  {periodSales.length === 0 ? (
                    <p className="text-slate-400 text-sm py-6 text-center">Nenhuma venda no período.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {periodSales.slice(0, 12).map(sale => (
                        <div key={sale.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 text-sm">{sale.customer_name || 'Cliente avulso'}</span>
                            <span className="text-xs text-slate-400">{format(new Date(sale.created_date), 'dd/MM HH:mm')} · {sale.payment_method}</span>
                          </div>
                          <span className="font-bold text-slate-800 text-sm">R$ {sale.total?.toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 pt-2">Integração NFC-e para emissão de cupom fiscal disponível em breve.</p>
                </div>
              )}
            </div>
          </div>

          {/* Middle: chart + CTA */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-700" /> Faturamento — 7 dias
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v) => [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Total']}
                    contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#334155" strokeWidth={2.5} dot={{ fill: '#334155', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <Link
              to="/pdv"
              className="block bg-slate-700 hover:bg-slate-800 transition-colors rounded-xl p-6 shadow-lg group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-white">Nova Venda</p>
                  <p className="text-sm text-slate-300">Abrir caixa</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          {/* Right: alerts + shortcuts */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas de Estoque
              </h2>
              {lowStock.length === 0 && outOfStock.length === 0 ? (
                <p className="text-slate-400 text-sm">Estoque em dia! ✓</p>
              ) : (
                <div className="space-y-2.5">
                  {outOfStock.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-sm text-slate-700 truncate flex-1">{p.name}</span>
                      <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded shrink-0">Sem estoque</span>
                    </div>
                  ))}
                  {lowStock.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-sm text-slate-700 truncate flex-1">{p.name}</span>
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded shrink-0">Baixo</span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/estoque" className="flex items-center gap-1 text-sm text-slate-700 font-medium hover:underline mt-4 pt-3 border-t border-slate-100">
                Ver estoque completo <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-base font-bold text-slate-800 mb-4">Atalhos</h2>
              <div className="space-y-1">
                {[
                  { to: '/produtos', label: 'Produtos', desc: 'Gerenciar catálogo' },
                  { to: '/vendas', label: 'Histórico', desc: 'Ver vendas' },
                  { to: '/catalogo', label: 'Catálogo Online', desc: 'Ver loja pública' },
                ].map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 group-hover:text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
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
    <div className="bg-white rounded-xl shadow-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
      <p className="text-sm text-slate-400 mt-1">{sub}</p>
    </div>
  );
}