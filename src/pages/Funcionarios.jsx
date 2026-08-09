import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { UserPlus, Loader2, Shield, Trash2, Crown, Briefcase, User as UserIcon, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useStore } from '@/hooks/useStore';
import { useAuth } from '@/lib/AuthContext';
import { ROLES, roleLabel } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import SellersManager from '@/components/SellersManager';

const ROLE_BADGE = {
  superadmin: 'bg-purple-100 text-purple-700 border-purple-200',
  org_admin: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
  store_manager: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  vendedor: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ROLE_ICON = { 
  superadmin: Crown, 
  org_admin: Building2, 
  store_manager: Briefcase, 
  vendedor: UserIcon 
};

const ROLE_DESC = {
  superadmin: 'Super Admin da Plataforma SaaS (Visão Global)',
  org_admin: 'Dono da Empresa / Grupo (Gestão das 5+ filiais e gerentes)',
  store_manager: 'Gerente da Loja (Operacional + Financeiro + Estoque)',
  vendedor: 'Vendedor / Operador (PDV, Clientes, Vendas e Trocas)',
};

export default function Funcionarios() {
  const { store } = useStore();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('vendedor');
  const [inviting, setInviting] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.User.list('-created_date', 200);
      const storeId = store?.id;
      setUsers((list || []).filter(u => {
        const sid = u?.data?.store_id || u?.store_id;
        return !storeId || sid === storeId || u.role === 'org_admin' || u.role === 'superadmin';
      }));
    } catch {
      toast({ title: 'Erro ao carregar usuários', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [store, toast]);

  useEffect(() => { load(); }, [load]);

  const currentRole = u => u?.role || u?.store_role || 'vendedor';

  const changeRole = async (userId, newRole) => {
    if (userId === me?.id && newRole !== 'superadmin' && newRole !== 'org_admin') {
      toast({ title: 'Você não pode rebaixar seu próprio acesso', variant: 'destructive' });
      return;
    }
    setSavingId(userId);
    try {
      await base44.entities.User.update(userId, { role: newRole, store_role: newRole, store_id: store?.id });
      toast({ title: 'Acesso atualizado', description: roleLabel(newRole) });
      await load();
    } catch {
      toast({ title: 'Erro ao atualizar acesso', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const createAccount = async () => {
    if (!email.trim() || !fullName.trim()) { 
      toast({ title: 'Informe o nome e o e-mail', variant: 'destructive' }); 
      return; 
    }
    setInviting(true);
    try {
      const created = await base44.entities.User.create({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        role: role,
        store_role: role,
        store_id: store?.id || '',
        organization_id: me?.organization_id || ''
      });
      toast({ title: 'Usuário cadastrado!', description: `${fullName} foi criado como ${roleLabel(role)}` });
      setEmail(''); setFullName(''); setRole('vendedor'); setInviteOpen(false);
      await load();
    } catch (e) {
      toast({ title: 'Erro ao cadastrar usuário', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full py-24"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">Usuários &amp; Níveis de Acesso</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie SuperAdmins, Donos de Empresa, Gerentes de Loja e Vendedores.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
          <UserPlus className="w-4 h-4 mr-2" /> Novo Usuário
        </Button>
      </div>

      {/* Legenda dos papéis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES.map(r => {
          const Icon = ROLE_ICON[r.key] || UserIcon;
          return (
            <div key={r.key} className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{r.label}</p>
                <p className="text-xs text-slate-500 mt-1 leading-tight">{ROLE_DESC[r.key]}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista de Usuários */}
      <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-border">
              <tr className="text-left text-slate-500">
                <th className="py-3 px-4 font-semibold">Usuário</th>
                <th className="py-3 px-4 font-semibold">E-mail</th>
                <th className="py-3 px-4 font-semibold">Nível de Acesso</th>
                <th className="py-3 px-4 font-semibold text-right">Alterar Nível</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-border">
              {users.map(u => {
                const r = currentRole(u);
                const Icon = ROLE_ICON[r] || UserIcon;
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                          {(u.full_name || u.email || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{u.full_name || '—'}</p>
                          {isMe && <span className="text-[10px] text-emerald-600 font-semibold">(você)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{u.email || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 border', ROLE_BADGE[r])}>
                        <Icon className="w-3.5 h-3.5" /> {roleLabel(r)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Select
                        value={r}
                        onValueChange={v => changeRole(u.id, v)}
                        disabled={savingId === u.id || (isMe && r === 'superadmin')}
                      >
                        <SelectTrigger className="h-8 w-44 text-xs ml-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(rr => (
                            <SelectItem key={rr.key} value={rr.key}>
                              {rr.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SellersManager />

      {/* Dialog de criação de usuário */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Cadastre usuários com os papéis de SuperAdmin, Dono de Empresa, Gerente ou Vendedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs font-medium text-slate-700 mb-1">Nome Completo</p>
              <Input placeholder="Ex: João da Silva" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-700 mb-1">E-mail</p>
              <Input type="email" placeholder="joao@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-700 mb-1">Nível de Acesso</p>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.key} value={r.key}>{r.label} — {ROLE_DESC[r.key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={createAccount} disabled={inviting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />} Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}