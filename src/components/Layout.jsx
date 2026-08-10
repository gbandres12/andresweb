import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { canAccess, homeForRole } from '@/lib/permissions';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, PackagePlus,
  Users, Menu, X, Store as StoreIcon, ChevronRight, ChevronDown, LogOut, Wallet, Calculator,
  Building2, ScanLine, FileText, Check, ChevronsUpDown, Plus, Settings, Globe, PieChart, ShieldAlert, ArrowLeftRight, RefreshCw, PackageCheck
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';
import StoreOnboarding from '@/components/StoreOnboarding';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

const navGroups = [
  {
    label: 'Visão Geral',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operação',
    items: [
      { path: '/pdv', label: 'PDV / Caixa', icon: ShoppingCart },
      { path: '/caixa-rapido', label: 'Caixa Rápido', icon: ScanLine },
      { path: '/vendas', label: 'Vendas', icon: StoreIcon },
      { path: '/trocas', label: 'Trocas', icon: RefreshCw },
      { path: '/consignacoes', label: 'Consignações', icon: PackageCheck },
      { path: '/clientes', label: 'Clientes', icon: Users },
    ],
  },
  {
    label: 'Estoque & Produtos',
    items: [
      { path: '/produtos', label: 'Produtos', icon: Package },
      { path: '/estoque', label: 'Estoque', icon: BarChart3, children: [
        { path: '/estoque/entrada', label: 'Entrada de Estoque', icon: PackagePlus },
        { path: '/importar-nfe', label: 'Importar NFe', icon: FileText },
        { path: '/entrada-inteligente', label: 'Entrada IA', icon: ScanLine },
        { path: '/transferencias', label: 'Transferências', icon: ArrowLeftRight },
        { path: '/pesquisa-global', label: 'Pesquisa Global', icon: Globe },
      ]},
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { path: '/financeiro', label: 'Financeiro', icon: Wallet },
      { path: '/relatorios', label: 'Relatórios', icon: PieChart },
      { path: '/calculadora', label: 'Calculadora', icon: Calculator },
    ],
  },
  {
    label: 'Administração',
    items: [
      { path: '/lojas', label: 'Minhas Lojas', icon: Building2 },
      { path: '/funcionarios', label: 'Funcionários', icon: Users },
      { path: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

function NavItem({ item, location, onNavigate }) {
  const Icon = item.icon;
  const active = location.pathname === item.path;
  const hasChildren = !!item.children?.length;
  const childActive = hasChildren && item.children.some(c => location.pathname === c.path);
  const [open, setOpen] = useState(childActive);

  if (!hasChildren) {
    return (
      <Link to={item.path} onClick={onNavigate} className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-all",
        active ? "bg-white/15 text-sidebar-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/10"
      )}>
        <Icon className={cn("w-4 h-4 shrink-0", active && "text-sidebar-foreground")} />
        <span>{item.label}</span>
        {active && <ChevronRight className="w-3 h-3 ml-auto text-sidebar-foreground" />}
      </Link>
    );
  }
  return (
    <div>
      <div className="flex items-center">
        <Link to={item.path} onClick={onNavigate} className={cn(
          "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-all",
          (active || childActive) ? "bg-white/15 text-sidebar-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/10"
        )}>
          <Icon className={cn("w-4 h-4 shrink-0", (active || childActive) && "text-sidebar-foreground")} />
          <span>{item.label}</span>
        </Link>
        <button onClick={() => setOpen(o => !o)} className="p-1.5 -ml-1 text-sidebar-foreground/60 hover:text-sidebar-foreground">
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="mt-0.5 ml-5 pl-3 border-l border-sidebar-border/50 space-y-0.5">
          {item.children.map(c => {
            const CIcon = c.icon;
            const cActive = location.pathname === c.path;
            return (
              <Link key={c.path} to={c.path} onClick={onNavigate} className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-sans font-medium transition-all",
                cActive ? "bg-white/15 text-sidebar-foreground" : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-white/10"
              )}>
                <CIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{c.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { store, stores, loading, needsOnboarding, completeOnboarding, switchStore } = useStore();
  const { user } = useAuth();

  const visibleGroups = navGroups
    .map(g => ({ ...g, items: g.items.filter(n => canAccess(n.path, user)) }))
    .filter(g => g.items.length > 0);

  useEffect(() => {
    if (user && !canAccess(location.pathname, user)) {
      navigate(homeForRole(user), { replace: true });
    }
  }, [user, location.pathname, navigate]);

  const accessBlocked = !!user && !canAccess(location.pathname, user);

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
        "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Brand + Store */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground text-xs font-serif font-semibold">S</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg font-semibold text-sidebar-foreground tracking-wide leading-tight">Andres WEB</h1>
              <p className="text-[11px] text-sidebar-foreground/50 font-sans leading-tight">Plataforma SaaS</p>
            </div>
          </div>

          {/* Store switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/10 border border-white/15 hover:bg-white/15 transition-colors text-left">
                <Building2 className="w-3.5 h-3.5 text-sidebar-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-sidebar-foreground/50 leading-none">Loja ativa</p>
                  <p className="text-xs font-medium text-sidebar-foreground truncate mt-0.5">{store?.name || '—'}</p>
                </div>
                <span className="text-[9px] uppercase tracking-wider bg-white/15 text-sidebar-foreground px-1.5 py-0.5 rounded-full font-semibold">
                  {store?.plan || 'free'}
                </span>
                <ChevronsUpDown className="w-3.5 h-3.5 text-sidebar-foreground/50 shrink-0" />
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
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {visibleGroups.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.path} item={item} location={location} onNavigate={() => setSidebarOpen(false)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <button
            onClick={() => base44.auth.logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/10 transition-all"
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
          {accessBlocked ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <ShieldAlert className="w-8 h-8" />
              <p className="text-sm">Você não tem acesso a esta área.</p>
            </div>
          ) : <Outlet />}
        </main>
      </div>
    </div>
  );
}