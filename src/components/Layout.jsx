import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { canAccess, homeForRole } from '@/lib/permissions';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, PackagePlus,
  Users, Menu, Store as StoreIcon, ChevronRight, ChevronDown, LogOut, Wallet, Calculator,
  Building2, ScanLine, FileText, Check, ChevronsUpDown, Plus, Settings, Globe, PieChart, ShieldAlert, ArrowLeftRight, RefreshCw, PackageCheck, Camera
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
      { path: '/', label: 'Painel Principal', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Vendas & Caixa',
    items: [
      { path: '/pdv', label: 'PDV / Ponto de Venda', icon: ShoppingCart },
      { path: '/caixa-rapido', label: 'Caixa Rápido', icon: ScanLine },
      { path: '/vendas', label: 'Histórico de Vendas', icon: StoreIcon },
      { path: '/trocas', label: 'Trocas e Devoluções', icon: RefreshCw },
      { path: '/consignacoes', label: 'Vendas Consignadas', icon: PackageCheck },
      { path: '/clientes', label: 'Cadastro de Clientes', icon: Users },
    ],
  },
  {
    label: 'Estoque & Entradas',
    items: [
      { path: '/produtos', label: 'Catálogo de Produtos', icon: Package },
      { path: '/estoque', label: 'Controle de Estoque', icon: BarChart3, children: [
        { path: '/importar-nfe', label: 'Importar Nota Fiscal (XML)', icon: FileText },
        { path: '/entrada-inteligente', label: 'Cadastro Rápido por Foto', icon: Camera },
        { path: '/estoque/entrada', label: 'Lançar Entrada Manual', icon: PackagePlus },
        { path: '/transferencias', label: 'Transferir entre Lojas', icon: ArrowLeftRight },
        { path: '/pesquisa-global', label: 'Estoque de Outras Filiais', icon: Globe },
      ]},
    ],
  },
  {
    label: 'Financeiro & Relatórios',
    items: [
      { path: '/financeiro', label: 'Contas & Caixas', icon: Wallet },
      { path: '/relatorios', label: 'Relatórios da Loja', icon: PieChart },
      { path: '/calculadora', label: 'Calculadora de Margem', icon: Calculator },
    ],
  },
  {
    label: 'Administração',
    items: [
      { path: '/lojas', label: 'Gerenciar Filiais', icon: Building2 },
      { path: '/funcionarios', label: 'Equipe / Vendedores', icon: Users },
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
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200",
        active 
          ? "bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-900/30" 
          : "text-emerald-100/70 hover:text-white hover:bg-emerald-800/40"
      )}>
        <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-emerald-400")} />
        <span>{item.label}</span>
        {active && <ChevronRight className="w-3 h-3 ml-auto text-white" />}
      </Link>
    );
  }
  return (
    <div>
      <div className="flex items-center">
        <Link to={item.path} onClick={onNavigate} className={cn(
          "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200",
          (active || childActive) 
            ? "bg-emerald-800/50 text-white font-semibold border border-emerald-700/50" 
            : "text-emerald-100/70 hover:text-white hover:bg-emerald-800/40"
        )}>
          <Icon className={cn("w-4 h-4 shrink-0", (active || childActive) ? "text-emerald-300" : "text-emerald-400")} />
          <span>{item.label}</span>
        </Link>
        <button onClick={() => setOpen(o => !o)} className="p-1.5 -ml-1 text-emerald-300 hover:text-white">
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="mt-1 ml-4 pl-3 border-l border-emerald-800/60 space-y-1">
          {item.children.map(c => {
            const CIcon = c.icon;
            const cActive = location.pathname === c.path;
            return (
              <Link key={c.path} to={c.path} onClick={onNavigate} className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150",
                cActive 
                  ? "bg-emerald-600 text-white font-semibold shadow-md" 
                  : "text-emerald-200/60 hover:text-white hover:bg-emerald-800/30"
              )}>
                <CIcon className={cn("w-3.5 h-3.5 shrink-0", cActive ? "text-white" : "text-emerald-400")} />
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Verde Esmeralda */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 shadow-2xl",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Brand + Store Header */}
        <div className="px-5 py-5 border-b border-emerald-900/60 bg-emerald-950/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-lg shadow-emerald-900/50">
              A
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-base text-white tracking-wide leading-tight">AndresWEB</h1>
              <p className="text-[11px] text-emerald-400 font-sans leading-tight">Gestão & Ponto de Venda</p>
            </div>
          </div>

          {/* Store switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-900/40 border border-emerald-800/60 hover:bg-emerald-800/50 transition-all text-left">
                <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-emerald-300/70 uppercase tracking-wider font-semibold">Loja ativa</p>
                  <p className="text-xs font-semibold text-white truncate mt-0.5">{store?.name || '—'}</p>
                </div>
                <ChevronsUpDown className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-slate-900 border-slate-800 text-white">
              <DropdownMenuLabel className="text-xs text-slate-400">Minhas filiais</DropdownMenuLabel>
              {stores.map(s => {
                const active = store?.id === s.id;
                return (
                  <DropdownMenuItem key={s.id} onClick={() => handleSwitch(s)} className="flex items-center gap-2 hover:bg-emerald-950 cursor-pointer">
                    <Check className={cn("w-3.5 h-3.5", active ? "text-emerald-400" : "opacity-0")} />
                    <span className="flex-1 truncate text-sm">{s.name}</span>
                    {active && <span className="text-[9px] uppercase font-semibold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded">ativa</span>}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem asChild>
                <Link to="/lojas" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 cursor-pointer">
                  <Settings className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-sm">Gerenciar filiais</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/lojas" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 cursor-pointer">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-sm">Nova loja</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Nav list */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {visibleGroups.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem key={item.path} item={item} location={location} onNavigate={() => setSidebarOpen(false)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-emerald-900/60 bg-emerald-950/40">
          <button
            onClick={() => base44.auth.logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-200/80 hover:text-white hover:bg-emerald-900/60 transition-all"
          >
            <LogOut className="w-4 h-4 text-emerald-400" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted text-emerald-600">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base text-foreground">
            {store?.name || 'Andres WEB'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
          {accessBlocked ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
              <p className="text-sm font-medium">Você não tem permissão para acessar esta área.</p>
            </div>
          ) : <Outlet />}
        </main>
      </div>
    </div>
  );
}