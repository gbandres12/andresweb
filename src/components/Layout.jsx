import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Package, BarChart3, 
  Users, Menu, X, Store, ChevronRight, LogOut
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pdv', label: 'PDV / Caixa', icon: ShoppingCart },
  { path: '/produtos', label: 'Produtos', icon: Package },
  { path: '/estoque', label: 'Estoque', icon: BarChart3 },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/vendas', label: 'Vendas', icon: Store },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-20 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="px-6 py-8 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-serif font-semibold">B</span>
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-foreground tracking-wide">Bella Store</h1>
              <p className="text-xs text-muted-foreground font-sans">Gestão & Catálogo</p>
            </div>
          </div>
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

        {/* Catálogo link */}
        <div className="px-3 py-3 border-t border-border">
          <Link
            to="/catalogo"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Store className="w-4 h-4" />
            <span>Ver Catálogo Online</span>
          </Link>
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
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-lg font-semibold">Bella Store</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}