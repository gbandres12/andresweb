import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import PDV from '@/pages/PDV';
import Produtos from '@/pages/Produtos';
import Estoque from '@/pages/Estoque';
import Vendas from '@/pages/Vendas';
import Clientes from '@/pages/Clientes';
import Catalogo from '@/pages/Catalogo';
import EntradaEstoque from '@/pages/EntradaEstoque';
import Financeiro from '@/pages/Financeiro';
import Calculadora from '@/pages/Calculadora';
import EntradaInteligente from '@/pages/EntradaInteligente';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Catálogo é sempre público — sem autenticação
  if (window.location.pathname === '/catalogo') {
    return (
      <Routes>
        <Route path="/catalogo" element={<Catalogo />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Public catalog — no layout wrapper */}
      <Route path="/catalogo" element={<Catalogo />} />

      {/* Admin app with sidebar layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pdv" element={<PDV />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/estoque/entrada" element={<EntradaEstoque />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/calculadora" element={<Calculadora />} />
        <Route path="/entrada-inteligente" element={<EntradaInteligente />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;