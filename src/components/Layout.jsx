import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  Users, Menu, X, Store as StoreIcon, ChevronRight, LogOut, Wallet, Calculator,
  Building2, ScanLine, FileText, Check, ChevronsUpDown, Plus, Settings, Globe, PieChart
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';
import StoreOnboarding from '@/components/StoreOnboarding';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pdv', label: 'PDV / Caixa', icon: ShoppingCart },
  { path: '/produtos', label: 'Produtos', icon: Package },
  { path: '/entrada-inteligente', label: 'Entrada IA', icon: ScanLine },
  { path: '/importar-nfe', label: 'Importar NFe', icon: FileText },
  { path: '/estoque', label: 'Estoque', icon: BarChart3 },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/vendas', label: 'Vendas', icon: StoreIcon },
  { path: '/financeiro', label: 'Financeiro', icon: Wallet },
  { path: '/calculadora', label: 'Calculadora', icon: Calculator },
  { path: '/lojas', label: 'Minhas Lojas', icon: Building2 },
  { path: '/pesquisa-global', label: 'Pesquisa Global', icon: Globe },
  { path: '/relatorios', label: 'Relatórios', icon: PieChart },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { store, stores, loading, needsOnboarding, completeOnboarding, switchStore } = useStore();

  if (needsOnboarding && !loading) {
    return <StoreOnboarding onDone={completeOnboarding} />;
  }

  const handleSwitch = async (s) => {
    await switchStore(s.id);
    setSidebarOpen(false);
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Brand + Store */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-serif font-semibold">S</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg font-semibold text-foreground tracking-wide leading-tight">Andres WEB</h1>
              <p className="text-[11px] text-muted-foreground font-sans leading-tight">Plataforma SaaS</p>
            </div>
          </div>

          {/* Store switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-accent/50 border border-accent hover:bg-accent transition-colors text-left">
                <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground leading-none">Loja ativa</p>
                  <p className="text-xs font-medium text-foreground truncate mt-0.5">{store?.name || '—'}</p>
                </div>
                <span className="text-[9px] uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                  {store?.plan || 'free'}
                </span>
                <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Minhas lojas</DropdownMenuLabel>
              {stores.map(s => {
                const active = store?.id === s.id;
                return (
                  <DropdownMenuItem key={s.id} onClick={() => handleSwitch(s)} className="flex items-center gap-2">
                    <Check className={cn("w-3.5 h-3.5", active ? "text-primary" : "opacity-0")} />
                    <span className="flex-1 truncate text-sm">{s.name}</span>
                    {active && <span className="text-[9px] uppercase font-semibold text-primary">ativa</span>}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/lojas" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 cursor-pointer">
                  <Settings className="w-3.5 h-3.5" /> <span className="text-sm">Gerenciar lojas</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/lojas" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> <span className="text-sm">Nova loja</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-all group",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")} />
                <span>{label}</span>
                {active && <ChevronRight className="w-3 h-3 ml-auto text-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-border">
          <button
            onClick={() => base44.auth.logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-lg font-semibold">
            {store?.name || 'Andres WEB'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}