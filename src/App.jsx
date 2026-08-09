import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import { StoreProvider } from '@/lib/StoreContext';
import Dashboard from '@/pages/Dashboard';
import PDV from '@/pages/PDV';
import CaixaRapido from '@/pages/CaixaRapido';
import Produtos from '@/pages/Produtos';
import Estoque from '@/pages/Estoque';
import Vendas from '@/pages/Vendas';
import Clientes from '@/pages/Clientes';
import Catalogo from '@/pages/Catalogo';
import EntradaEstoque from '@/pages/EntradaEstoque';
import Financeiro from '@/pages/Financeiro';
import Calculadora from '@/pages/Calculadora';
import EntradaInteligente from '@/pages/EntradaInteligente';
import ImportarNFe from '@/pages/ImportarNFe';
import MinhasLojas from '@/pages/MinhasLojas';
import PesquisaGlobal from '@/pages/PesquisaGlobal';
import Relatorios from '@/pages/Relatorios';
import Funcionarios from '@/pages/Funcionarios';
import Configuracoes from '@/pages/Configuracoes';
import ConfiguracaoLoja from '@/pages/ConfiguracaoLoja';
import Transferencias from '@/pages/Transferencias';
import Trocas from '@/pages/Trocas';
import Consignacoes from '@/pages/Consignacoes';
import Login from '@/pages/Login';
import SuperAdmin from '@/pages/SuperAdmin';

const ProtectedRoute = ({ children }) => {
  const { isLoadingAuth, isAuthenticated, authError } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white">
        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || authError?.type === 'auth_required') {
    return <Navigate to="/login" replace />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white">
        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/catalogo" element={<Catalogo />} />
      <Route 
        path="/login" 
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        } 
      />

      {/* Rota Especial Caixa Rápido */}
      <Route 
        path="/caixa-rapido" 
        element={
          <ProtectedRoute>
            <StoreProvider><CaixaRapido /></StoreProvider>
          </ProtectedRoute>
        } 
      />

      {/* Rotas Protegidas no Layout Admin */}
      <Route 
        element={
          <ProtectedRoute>
            <StoreProvider><Layout /></StoreProvider>
          </ProtectedRoute>
        }
      >
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
        <Route path="/importar-nfe" element={<ImportarNFe />} />
        <Route path="/lojas" element={<MinhasLojas />} />
        <Route path="/pesquisa-global" element={<PesquisaGlobal />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/funcionarios" element={<Funcionarios />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/lojas/:id/configurar" element={<ConfiguracaoLoja />} />
        <Route path="/transferencias" element={<Transferencias />} />
        <Route path="/trocas" element={<Trocas />} />
        <Route path="/consignacoes" element={<Consignacoes />} />
        <Route path="/admin" element={<SuperAdmin />} />
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
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;