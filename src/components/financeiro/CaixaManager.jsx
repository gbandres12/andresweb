import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { Wallet, Lock, Plus, Minus, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import PasswordModal from '@/components/financeiro/caixa/PasswordModal';
import { OpenRegisterForm, MovementForm, CloseConfirmForm, ChangePasswordForm } from '@/components/financeiro/caixa/CaixaForms';

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
const normMethod = m => (m === 'Dinheiro' || m === 'PIX') ? m : (m && m.startsWith('Cartão') ? 'Cartão' : null);

const TITLES = {
  open: 'Abrir Caixa',
  sangria: 'Sangria',
  suprimento: 'Suprimento',
  close: 'Fechar Caixa',
  changePwd: 'Alterar Senha do Gerente',
};

export default function CaixaManager({ sales }) {
  const { store, reload: reloadStore } = useStore();
  const [user, setUser] = useState(null);
  const [register, setRegister] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [activeForm, setActiveForm] = useState(null);

  const managerPwd = store?.settings?.manager_password || '1234';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const regs = await base44.entities.CashRegister.filter({ status: 'aberto' }, '-opened_at', 1);
      const reg = regs[0] || null;
      setRegister(reg);
      if (reg) {
        const movs = await base44.entities.CashMovement.filter({ register_id: reg.id }, '-created_date', 500);
        setMovements(movs);
      } else {
        setMovements([]);
      }
    } catch {
      setRegister(null);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
  }, [load]);

  const operatorName = user?.full_name || user?.email || 'Gerente';

  const totals = useMemo(() => {
    const openedAt = register?.opened_at ? new Date(register.opened_at) : null;
    const regSales = (sales || []).filter(s =>
      s.status === 'concluida' && openedAt && new Date(s.created_date) >= openedAt
    );
    const salesBy = m => regSales.filter(s => normMethod(s.payment_method) === m).reduce((sum, s) => sum + (s.total || 0), 0);
    const movBy = (type, m) => movements.filter(mv => mv.type === type && mv.payment_method === m).reduce((sum, mv) => sum + (mv.amount || 0), 0);
    const opening = register?.opening_balance || 0;
    const dinheiro = opening + salesBy('Dinheiro') + movBy('suprimento', 'Dinheiro') - movBy('sangria', 'Dinheiro');
    const pix = salesBy('PIX') + movBy('suprimento', 'PIX') - movBy('sangria', 'PIX');
    const cartao = salesBy('Cartão') + movBy('suprimento', 'Cartão') - movBy('sangria', 'Cartão');
    return { Dinheiro: dinheiro, PIX: pix, Cartão: cartao, total: dinheiro + pix + cartao };
  }, [register, movements, sales]);

  const openRegister = async (openingBalance) => {
    await base44.entities.CashRegister.create({
      status: 'aberto',
      opened_at: new Date().toISOString(),
      opened_by_name: operatorName,
      opening_balance: openingBalance,
    });
    toast.success('Caixa aberto');
    setActiveForm(null);
    await load();
  };

  const addMovement = async ({ type, amount, payment_method, description }) => {
    if (!register) return;
    await base44.entities.CashMovement.create({
      register_id: register.id,
      type,
      amount,
      payment_method,
      description,
      operator_name: operatorName,
    });
    toast.success(type === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado');
    setActiveForm(null);
    await load();
  };

  const closeRegister = async () => {
    await base44.entities.CashRegister.update(register.id, {
      status: 'fechado',
      closed_at: new Date().toISOString(),
      closed_by_name: operatorName,
      expected_dinheiro: totals.Dinheiro,
      expected_pix: totals.PIX,
      expected_cartao: totals.Cartão,
      closing_balance: totals.total,
    });
    toast.success('Caixa fechado');
    setActiveForm(null);
    await load();
  };

  const changePassword = async (newPwd) => {
    await base44.entities.Store.update(store.id, {
      settings: { ...(store.settings || {}), manager_password: newPwd },
    });
    toast.success('Senha de gerente alterada');
    setActiveForm(null);
    await reloadStore();
  };

  const onAuthSuccess = () => {
    setActiveForm(pendingAction);
    setPendingAction(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const methodCards = [
    { label: 'Dinheiro', value: totals.Dinheiro, cls: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'PIX', value: totals.PIX, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Cartão', value: totals.Cartão, cls: 'bg-purple-50 border-purple-200 text-purple-700' },
  ];

  return (
    <div className="space-y-6">
      {!register ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-xl font-semibold">Caixa Fechado</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Abra o caixa para iniciar as operações do dia.</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={() => setPendingAction('open')}><Lock className="w-4 h-4 mr-1.5" /> Abrir Caixa</Button>
            <Button variant="outline" onClick={() => setPendingAction('changePwd')}><Settings className="w-4 h-4 mr-1.5" /> Alterar senha do gerente</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="font-serif text-lg font-semibold">Caixa Aberto</p>
                <p className="text-xs text-muted-foreground">
                  Aberto em {format(new Date(register.opened_at), "dd/MM/yyyy 'às' HH:mm")} por {register.opened_by_name || '—'}
                </p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Aberto</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {methodCards.map(c => (
              <div key={c.label} className={cn('rounded-2xl border p-4', c.cls)}>
                <p className="text-xs opacity-80 mb-1">{c.label}</p>
                <p className="text-lg font-serif font-semibold tabular-nums">{fmt(c.value)}</p>
              </div>
            ))}
            <div className="rounded-2xl border p-4 bg-primary text-primary-foreground">
              <p className="text-xs opacity-80 mb-1">Total Geral</p>
              <p className="text-lg font-serif font-semibold tabular-nums">{fmt(totals.total)}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setPendingAction('sangria')}><Minus className="w-4 h-4 mr-1.5" /> Sangria</Button>
            <Button variant="outline" onClick={() => setPendingAction('suprimento')}><Plus className="w-4 h-4 mr-1.5" /> Suprimento</Button>
            <Button onClick={() => setPendingAction('close')}><LogOut className="w-4 h-4 mr-1.5" /> Fechar Caixa</Button>
            <Button variant="ghost" onClick={() => setPendingAction('changePwd')}><Settings className="w-4 h-4 mr-1.5" /> Alterar senha</Button>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-serif text-base font-semibold">Movimentações do Caixa</h3>
            </div>
            {movements.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 text-sm">Nenhuma movimentação registrada</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Forma</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Horário</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(mv => (
                    <tr key={mv.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', mv.type === 'sangria' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600')}>
                          {mv.type === 'sangria' ? 'Sangria' : 'Suprimento'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{mv.description || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{mv.payment_method}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{format(new Date(mv.created_date), 'dd/MM HH:mm')}</td>
                      <td className={cn('px-4 py-3 text-right text-sm font-semibold tabular-nums', mv.type === 'sangria' ? 'text-red-600' : 'text-green-600')}>
                        {mv.type === 'sangria' ? '-' : '+'} {fmt(mv.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <PasswordModal
        open={!!pendingAction}
        title={TITLES[pendingAction]}
        correctPassword={managerPwd}
        onSuccess={onAuthSuccess}
        onClose={() => setPendingAction(null)}
      />

      <Dialog open={!!activeForm} onOpenChange={v => { if (!v) setActiveForm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{TITLES[activeForm]}</DialogTitle></DialogHeader>
          {activeForm === 'open' && <OpenRegisterForm onOpen={openRegister} onClose={() => setActiveForm(null)} />}
          {activeForm === 'sangria' && <MovementForm kind="sangria" onSubmit={d => addMovement({ type: 'sangria', ...d })} onClose={() => setActiveForm(null)} />}
          {activeForm === 'suprimento' && <MovementForm kind="suprimento" onSubmit={d => addMovement({ type: 'suprimento', ...d })} onClose={() => setActiveForm(null)} />}
          {activeForm === 'close' && <CloseConfirmForm totals={totals} onConfirm={closeRegister} onClose={() => setActiveForm(null)} />}
          {activeForm === 'changePwd' && <ChangePasswordForm currentPassword={managerPwd} onChange={changePassword} onClose={() => setActiveForm(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}