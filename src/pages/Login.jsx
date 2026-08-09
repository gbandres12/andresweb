import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { homeForRole } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, Lock, Mail, User, ShoppingBag, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const { checkUserAuth } = useAuth();
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regStoreName, setRegStoreName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      setLoading(true);
      const res = await base44.auth.login(loginEmail, loginPassword);
      toast.success('Login realizado com sucesso!');
      await checkUserAuth();
      window.location.href = homeForRole(res.user);
    } catch (err) {
      toast.error(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regFullName) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const res = await base44.auth.register({
        email: regEmail,
        password: regPassword,
        full_name: regFullName,
        store_name: regStoreName
      });
      toast.success('Conta e Loja criadas com sucesso!');
      await checkUserAuth();
      window.location.href = homeForRole(res.user);
    } catch (err) {
      toast.error(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner border border-primary/20">
            <ShoppingBag className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">AndresWeb</h1>
          <p className="text-slate-400 text-sm">Plataforma ERP & Ponto de Venda (PDV)</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/80 p-1">
                <TabsTrigger value="login" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">Entrar</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">Criar Loja</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              {/* ABA LOGIN */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-200">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-9 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-9 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? 'Entrando...' : <>Acessar o Sistema <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                </form>
              </TabsContent>

              {/* ABA REGISTRO */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        type="text"
                        placeholder="Seu Nome"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="pl-9 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Nome da Loja</Label>
                    <div className="relative">
                      <Store className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        type="text"
                        placeholder="Ex: Minha Loja Matriz"
                        value={regStoreName}
                        onChange={(e) => setRegStoreName(e.target.value)}
                        className="pl-9 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="pl-9 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="pl-9 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? 'Criando Conta...' : <>Cadastrar Minha Loja <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
