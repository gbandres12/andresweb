import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { UserPlus, Loader2, Shield, Trash2, Crown, Briefcase, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useStore } from '@/lib/StoreContext';
import { useAuth } from '@/lib/AuthContext';
import { STORE_ROLES, roleLabel } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import SellersManager from '@/components/SellersManager';

const ROLE_BADGE = {
  owner: 'bg-primary/10 text-primary border-primary/20',
  manager: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  staff: 'bg-slate-100 text-slate-600 border-slate-200',
};
const ROLE_ICON = { owner: Crown, manager: Briefcase, staff: UserIcon };

export default function Funcionarios() {
  const { store } = useStore();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [inviting, setInviting] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.User.list('-created_date', 200);
      const storeId = store?.id;
      // usuários da loja atual (mesmo store_id) + o próprio admin/dono
      setUsers((list || []).filter(u => {
        const sid = u?.data?.store_id || u?.store_id;
        return !storeId || sid === storeId || u.role === 'admin';
      }));
    } catch {
      toast({ title: 'Erro ao carregar funcionários', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [store, toast]);

  useEffect(() => { load(); }, [load]);

  const currentStoreRole = u => u?.data?.store_role || u?.store_role || (u?.role === 'admin' ? 'owner' : 'staff');

  const changeRole = async (userId, newRole) => {
    if (userId === me?.id && newRole !== 'owner') {
      toast({ title: 'Você não pode remover seu próprio acesso de dono', variant: 'destructive' });
      return;
    }
    setSavingId(userId);
    try {
      await base44.entities.User.update(userId, { store_role: newRole, store_id: store?.id });
      toast({ title: 'Acesso atualizado', description: roleLabel(newRole) });
      await load();
    } catch {
      toast({ title: 'Erro ao atualizar acesso', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const removeAccess = async (userId) => {
    if (userId === me?.id) {
      toast({ title: 'Você não pode remover seu próprio acesso', variant: 'destructive' });
      return;
    }
    setSavingId(userId);
    try {
      await base44.entities.User.update(userId, { store_role: 'staff', store_id: '' });
      toast({ title: 'Acesso à loja removido' });
      await load();
    } catch {
      toast({ title: 'Erro ao remover acesso', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const invite = async () => {
    if (!email.trim()) { toast({ title: 'Informe o e-mail', variant: 'destructive' }); return; }
    setInviting(true);
    try {
      await base44.users.inviteUser(email.trim(), 'user');
      // tenta atribuir store_id + store_role imediatamente
      try {
        const list = await base44.entities.User.list('-created_date', 200);
        const u = (list || []).find(x => (x.email || '').toLowerCase() === email.trim().toLowerCase());
        if (u) await base44.entities.User.update(u.id, { store_role: role, store_id: store?.id });
      } catch { /* usuário pode não ter aceitado ainda */ }
      toast({ title: 'Convite enviado', description: `${email.trim()} foi convidado como ${roleLabel(role)}` });
      setEmail(''); setRole('staff'); setInviteOpen(false);
      await load();
    } catch (e) {
      toast({ title: 'Erro ao convidar', description: e?.message || 'Verifique o e-mail', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">Funcionários &amp; Acessos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie quem acessa a loja <strong>{store?.name}</strong> e o nível de cada um.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4" /> Convidar funcionário
        </Button>
      </div>

      {/* Legenda dos papéis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STORE_ROLES.map(r => {
          const Icon = ROLE_ICON[r.key];
          return (
            <div key={r.key} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{ROLE_DESC[r.key]}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="py-3 px-4 font-medium">Funcionário</th>
                <th className="py-3 px-4 font-medium">E-mail</th>
                <th className="py-3 px-4 font-medium">Nível de acesso</th>
                <th className="py-3 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const r = currentStoreRole(u);
                const Icon = ROLE_ICON[r] || UserIcon;
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {(u.full_name || u.email || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.full_name || '—'}</p>
                          {isMe && <span className="text-[10px] text-muted-foreground">(você)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{u.email || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 border', ROLE_BADGE[r])}>
                        <Icon className="w-3 h-3" /> {roleLabel(r)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={r}
                          onValueChange={v => changeRole(u.id, v)}
                          disabled={savingId === u.id || r === 'owner' && isMe}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STORE_ROLES.map(rr => (
                              <SelectItem key={rr.key} value={rr.key} disabled={rr.key === 'owner' && !isMe && me?.role !== 'admin'}>
                                {rr.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAccess(u.id)}
                          disabled={savingId === u.id || isMe}
                          title="Remover acesso à loja"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Nenhum funcionário vinculado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendedores / Equipe de vendas */}
      <SellersManager />

      {/* Dialog de convite */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar funcionário</DialogTitle>
            <DialogDescription>
              A pessoa receberá um convite por e-mail e, ao aceitar, terá acesso à loja com o nível escolhido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input type="email" placeholder="E-mail do funcionário" value={email} onChange={e => setEmail(e.target.value)} />
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Nível de acesso</p>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORE_ROLES.filter(r => r.key !== 'owner').map(r => (
                    <SelectItem key={r.key} value={r.key}>{r.label} — {ROLE_DESC[r.key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={invite} disabled={inviting}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ROLE_DESC = {
  owner: 'Acesso total, gestão de lojas e funcionários',
  manager: 'Acesso gerencial: vendas, estoque e financeiro',
  staff: 'Acesso limitado: PDV, clientes e vendas',
};