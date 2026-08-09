import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Users, Building2, Store, DollarSign, Search,
  Crown, Briefcase, User as UserIcon, Activity, Sparkles,
  Plus, Trash2, TrendingUp, Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip
} from 'recharts';

const ROLE_BADGE = {
  superadmin: 'bg-purple-500/10 text-purple-400 border-purple-500/20 font-bold',
  org_admin: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold',
  store_manager: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  vendedor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const ROLE_ICON = { 
  superadmin: Crown, 
  org_admin: Building2, 
  store_manager: Briefcase, 
  vendedor: UserIcon 
};

export default function SuperAdmin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [loading, setLoading] = useState(true);

  // Core Data
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('all');

  // Dialog controls
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('org_admin');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Actions states
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // Fetch all data
  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, oList, sList, pList, saList] = await Promise.all([
        base44.entities.User.list('-created_date', 500),
        base44.entities.Organization.list('-created_date', 100),
        base44.entities.Store.list('-created_date', 100),
        base44.entities.Product.list('-created_date', 1000),
        base44.entities.Sale.list('-created_date', 1000)
      ]);

      setUsers(uList || []);
      setOrganizations(oList || []);
      setStores(sList || []);
      setProducts(pList || []);
      setSales(saList || []);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao carregar dados SaaS',
        description: 'Verifique se a integração do Supabase foi configurada corretamente.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Usability Stats
  const tenantStats = useMemo(() => {
    return organizations.map(org => {
      const orgStores = stores.filter(s => s.organization_id === org.id);
      const orgUsers = users.filter(u => u.organization_id === org.id);
      const orgProducts = products.filter(p => p.organization_id === org.id);
      const orgSales = sales.filter(s => s.organization_id === org.id);
      const totalRevenue = orgSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      
      let usageScore = 0;
      if (orgProducts.length > 0) usageScore += 20;
      if (orgSales.length > 0) usageScore += 30;
      if (orgSales.length > 10) usageScore += 30;
      if (orgStores.length > 1) usageScore += 20;

      let usageLevel = 'Baixa';
      let usageBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      if (usageScore >= 70) {
        usageLevel = 'Forte';
        usageBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      } else if (usageScore >= 30) {
        usageLevel = 'Média';
        usageBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      }

      return {
        ...org,
        storesCount: orgStores.length,
        usersCount: orgUsers.length,
        productsCount: orgProducts.length,
        salesCount: orgSales.length,
        totalRevenue,
        usageLevel,
        usageBadge,
        usageScore
      };
    });
  }, [organizations, stores, users, products, sales]);

  // Chart data: Registros por mês
  const chartData = useMemo(() => {
    // Agrupar cadastros de clientes por mês
    const counts = {};
    organizations.forEach(org => {
      const date = new Date(org.created_at || org.created_date || Date.now());
      const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.keys(counts).map(key => ({
      name: key,
      Clientes: counts[key]
    })).reverse();
  }, [organizations]);

  // Global Counts
  const totalSalesVolume = useMemo(() => {
    return sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  }, [sales]);

  // Handlers
  const handleRoleChange = async (userId, newRole) => {
    setUpdatingUserId(userId);
    try {
      await base44.entities.User.update(userId, {
        role: newRole,
        store_role: newRole
      });
      toast({
        title: 'Nível de acesso alterado',
        description: `O usuário agora é ${newRole}.`
      });
      loadData();
    } catch {
      toast({
        title: 'Falha ao alterar acesso',
        variant: 'destructive'
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setIsSubmittingUser(true);
    try {
      await base44.auth.register({
        email: newUserEmail.trim(),
        password: newUserPassword,
        full_name: newUserName.trim(),
        store_name: 'Minha Loja Matriz'
      });

      // Se um papel diferente foi selecionado, atualizamos no Supabase
      if (newUserRole !== 'org_admin') {
        const list = await base44.entities.User.list('-created_date', 1);
        const createdUser = list[0];
        if (createdUser && createdUser.email === newUserEmail.trim()) {
          await base44.entities.User.update(createdUser.id, {
            role: newUserRole,
            store_role: newUserRole
          });
        }
      }

      toast({
        title: 'Usuário cadastrado com sucesso!',
        description: `Enviado cadastro para ${newUserEmail}.`
      });
      setCreateUserOpen(false);
      
      // Limpa os estados
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('org_admin');
      
      loadData();
    } catch (err) {
      toast({
        title: 'Erro ao cadastrar usuário',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Tem certeza de que deseja remover este usuário da plataforma SaaS?')) return;
    try {
      await base44.entities.User.delete(userId);
      toast({
        title: 'Usuário removido',
        description: 'Conta excluída com sucesso.'
      });
      loadData();
    } catch {
      toast({
        title: 'Erro ao remover usuário',
        variant: 'destructive'
      });
    }
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const name = String(u.full_name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const search = searchQuery.toLowerCase();
      return name.includes(search) || email.includes(search);
    });
  }, [users, searchQuery]);

  const filteredTenants = useMemo(() => {
    return tenantStats.filter(t => {
      const name = String(t.name || '').toLowerCase();
      const search = searchQuery.toLowerCase();
      const matchSearch = name.includes(search);
      const matchPlan = selectedPlan === 'all' || t.plan === selectedPlan;
      return matchSearch && matchPlan;
    });
  }, [tenantStats, searchQuery, selectedPlan]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-100 bg-slate-950/40 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl font-bold tracking-tight text-white">Painel Master Admin</h1>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/10">SaaS Ativo</Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">Supervisão global, monitoramento de saúde do Supabase, auditoria de usabilidade e gestão de clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-300">
            <Activity className="w-4 h-4 mr-2 text-emerald-400 animate-pulse" /> Atualizar Dados
          </Button>
          <Button onClick={() => setCreateUserOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20">
            <Plus className="w-4 h-4 mr-2" /> Novo Usuário Admin
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Clientes Ativos (SaaS)</CardTitle>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{organizations.length}</div>
            <p className="text-xs text-slate-500 mt-1">Empresas e grupos cadastrados</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Total de Usuários</CardTitle>
            <Users className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{users.length}</div>
            <p className="text-xs text-slate-500 mt-1">Contas vinculadas na plataforma</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Lojas Operando</CardTitle>
            <Store className="w-4 h-4 text-pink-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stores.length}</div>
            <p className="text-xs text-slate-500 mt-1">Filiais / Canais físicos ativos</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Volume Total Vendas</CardTitle>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {totalSalesVolume.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Transacionado de forma agregada</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <TabsTrigger value="usuarios" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
            <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Contas e Usuários
          </TabsTrigger>
          <TabsTrigger value="clientes" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
            <Building2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Clientes (Empresas)
          </TabsTrigger>
          <TabsTrigger value="usabilidade" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
            <Activity className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Métricas de Usabilidade
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Usuários */}
        <TabsContent value="usuarios" className="space-y-4 mt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Pesquisar por nome ou e-mail..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-800 text-slate-100 focus:ring-emerald-500/50"
              />
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              Exibindo {filteredUsers.length} usuários.
            </div>
          </div>

          <Card className="bg-slate-900/40 border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-900/60 border-slate-800">
                <TableRow>
                  <TableHead className="text-slate-400 font-medium">Nome</TableHead>
                  <TableHead className="text-slate-400 font-medium">E-mail</TableHead>
                  <TableHead className="text-slate-400 font-medium">Acesso / Papel</TableHead>
                  <TableHead className="text-slate-400 font-medium">Empresa (ID)</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      Carregando usuários...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => {
                    const RoleIcon = ROLE_ICON[user.role] || UserIcon;
                    return (
                      <TableRow key={user.id} className="border-slate-800 hover:bg-slate-900/30">
                        <TableCell className="font-semibold text-white">{user.full_name}</TableCell>
                        <TableCell className="text-slate-300 font-mono text-xs">{user.email}</TableCell>
                        <TableCell>
                          <Select
                            disabled={updatingUserId === user.id}
                            value={user.role || 'vendedor'}
                            onValueChange={val => handleRoleChange(user.id, val)}
                          >
                            <SelectTrigger className="w-40 bg-slate-900 border-slate-800 text-xs">
                              <span className="flex items-center gap-1.5">
                                <RoleIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span className={ROLE_BADGE[user.role || 'vendedor']}>
                                  {user.role === 'superadmin' ? 'Super Admin' : user.role === 'org_admin' ? 'Dono' : user.role === 'store_manager' ? 'Gerente' : 'Vendedor'}
                                </span>
                              </span>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                              <SelectItem value="vendedor" className="hover:bg-slate-800">Vendedor</SelectItem>
                              <SelectItem value="store_manager" className="hover:bg-slate-800">Gerente da Loja</SelectItem>
                              <SelectItem value="org_admin" className="hover:bg-slate-800">Dono da Empresa</SelectItem>
                              <SelectItem value="superadmin" className="hover:bg-slate-800 text-purple-400 font-semibold">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-slate-400 font-mono text-xs max-w-[150px] truncate">
                          {user.organization_id || 'Autônomo / Local'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2 h-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 2: Clientes */}
        <TabsContent value="clientes" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Esquerda: Lista de Clientes */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex gap-4 items-center justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="Filtrar por nome da empresa..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger className="w-36 bg-slate-900 border-slate-800">
                    <SelectValue placeholder="Plano" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="all">Todos Planos</SelectItem>
                    <SelectItem value="pro">Plano Pro</SelectItem>
                    <SelectItem value="basic">Plano Basic</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="bg-slate-900/40 border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-900/60 border-slate-800">
                    <TableRow>
                      <TableHead className="text-slate-400 font-medium">Nome</TableHead>
                      <TableHead className="text-slate-400 font-medium">Plano</TableHead>
                      <TableHead className="text-slate-400 font-medium">Lojas</TableHead>
                      <TableHead className="text-slate-400 font-medium">Membros</TableHead>
                      <TableHead className="text-slate-400 font-medium">Data de Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          Carregando organizações...
                        </TableCell>
                      </TableRow>
                    ) : filteredTenants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          Nenhum cliente cadastrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTenants.map(tenant => (
                        <TableRow key={tenant.id} className="border-slate-800 hover:bg-slate-900/30">
                          <TableCell className="font-semibold text-white">{tenant.name}</TableCell>
                          <TableCell>
                            <Badge className={
                              tenant.plan === 'pro'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : tenant.plan === 'enterprise'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }>
                              {String(tenant.plan || 'pro').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300 font-semibold">{tenant.storesCount} loja(s)</TableCell>
                          <TableCell className="text-slate-300">{tenant.usersCount} usuário(s)</TableCell>
                          <TableCell className="text-slate-400 font-sans text-xs">
                            {new Date(tenant.created_at || tenant.created_date || Date.now()).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Direita: Gráfico de Crescimento */}
            <Card className="bg-slate-900/40 border-slate-800 p-4 flex flex-col justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1 text-white">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Crescimento da Plataforma
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">Registros de novos clientes ao longo do tempo</CardDescription>
              </div>
              <div className="h-48 mt-4">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                      <Area type="monotone" dataKey="Clientes" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorClients)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">Aguardando dados...</div>
                )}
              </div>
              <div className="border-t border-slate-850 pt-3 mt-4 text-[11px] text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Monitoramento contínuo da base.
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Usabilidade */}
        <TabsContent value="usabilidade" className="space-y-4 mt-6">
          <Card className="bg-slate-900/40 border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-900/60 border-slate-800">
                <TableRow>
                  <TableHead className="text-slate-400 font-medium">Nome do Cliente / Organização</TableHead>
                  <TableHead className="text-slate-400 font-medium">Nível de Atividade</TableHead>
                  <TableHead className="text-slate-400 font-medium">Qtd. Lojas</TableHead>
                  <TableHead className="text-slate-400 font-medium">Produtos Cadastrados</TableHead>
                  <TableHead className="text-slate-400 font-medium">Vendas Realizadas</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Calculando métricas de usabilidade...
                    </TableCell>
                  </TableRow>
                ) : tenantStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Nenhuma métrica disponível.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenantStats.map(stat => (
                    <TableRow key={stat.id} className="border-slate-800 hover:bg-slate-900/30">
                      <TableCell className="font-semibold text-white">{stat.name}</TableCell>
                      <TableCell>
                        <Badge className={`border ${stat.usageBadge}`}>
                          {stat.usageLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300 font-medium">{stat.storesCount}</TableCell>
                      <TableCell className="text-slate-300">{stat.productsCount} itens</TableCell>
                      <TableCell className="text-slate-300 font-semibold">{stat.salesCount} ped.</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-emerald-400">
                        {stat.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Create Master/Admin User */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Criar Novo Usuário SaaS</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">Cadastre um novo usuário com cargo configurável diretamente no banco Supabase.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200">Nome Completo</label>
              <Input
                type="text"
                required
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white"
                placeholder="Ex: Pedro Henrique"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200">Endereço de E-mail</label>
              <Input
                type="email"
                required
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white"
                placeholder="Ex: pedro@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200">Senha Inicial</label>
              <Input
                type="password"
                required
                value={newUserPassword}
                onChange={e => setNewUserPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200">Perfil de Acesso</label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="org_admin" className="hover:bg-slate-800">Dono da Empresa (Org Admin)</SelectItem>
                  <SelectItem value="superadmin" className="hover:bg-slate-800 text-purple-400 font-semibold">Super Admin da Plataforma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4 border-t border-slate-850">
              <Button type="button" variant="ghost" onClick={() => setCreateUserOpen(false)} className="text-slate-400 hover:text-white">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingUser} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {isSubmittingUser ? 'Gravando...' : 'Criar Conta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
