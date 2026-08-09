import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { useAuth } from '@/lib/AuthContext';
import { isManager } from '@/lib/permissions';
import { Wallet, Lock, Plus, Minus, LogOut, Settings, History, Upload, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import PasswordModal from '@/components/financeiro/caixa/PasswordModal';
import { OpenRegisterForm, MovementForm, CloseConfirmForm, ChangePasswordForm } from '@/components/financeiro/caixa/CaixaForms';
import CaixaLedger from '@/components/financeiro/caixa/CaixaLedger';
import CaixaLog from '@/components/financeiro/caixa/CaixaLog';
import ContasImporter from '@/components/financeiro/ContasImporter';

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
  const { user } = useAuth();
  const [register, setRegister] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [activeForm, setActiveForm] = useState(null);
  const [view, setView] = useState('current');
  const [showImporter, setShowImporter] = useState(false);

  // Permissões baseadas no role
  const isGerente = isManager(user);

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
    load();
  }, [load]);

  const operatorName = user?.full_name || user?.email || 'Gerente';

  const totals = useMemo(() => {
    const openedAt = register?.opened_at ? new Date(register.opened_at) : null;
    const regSales = (sales || []).filter(s =>
      s.status === 'concluida' && openedAt && new Date(s.created_date) >= openedAt
    );
    const salesBy = m => regSales.filter(s => normMethod(s.payment_method) === m).reduce((sum, s) => sum + (s.total || 0), 0);
    const salesConsignado = regSales
      .filter(s => s.payment_method === 'Consignação' || s.sale_type === 'consignacao')
      .reduce((sum, s) => sum + (s.total || 0), 0);
    const movBy = (type, m) => movements.filter(mv => mv.type === type && mv.payment_method === m).reduce((sum, mv) => sum + (mv.amount || 0), 0);
    const opening = register?.opening_balance || 0;
    const dinheiro = opening + salesBy('Dinheiro') + movBy('suprimento', 'Dinheiro') - movBy('sangria', 'Dinheiro');
    const pix = salesBy('PIX') + movBy('suprimento', 'PIX') - movBy('sangria', 'PIX');
    const cartao = salesBy('Cartão') + movBy('suprimento', 'Cartão') - movBy('sangria', 'Cartão');
    const consignado = salesConsignado;
    return { Dinheiro: dinheiro, PIX: pix, Cartão: cartao, Consignado: consignado, total: dinheiro + pix + cartao };
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
      type, amount, payment_method, description,
      operator_name: operatorName,
    });
    toast.success(type === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado');
    setActiveForm(null);
    await load();
  };

  const closeRegister = async (counted) => {
    const countedTotal =
      (counted.counted_dinheiro || 0) + (counted.counted_pix || 0) +
      (counted.counted_cartao || 0) + (counted.counted_consignado || 0);
    await base44.entities.CashRegister.update(register.id, {
      status: 'fechado',
      closed_at: new Date().toISOString(),
      closed_by_name: operatorName,
      expected_dinheiro: totals.Dinheiro,
      expected_pix: totals.PIX,
      expected_cartao: totals.Cartão,
      expected_consignado: totals.Consignado,
      counted_dinheiro: counted.counted_dinheiro,
      counted_pix: counted.counted_pix,
      counted_cartao: counted.counted_cartao,
      counted_consignado: counted.counted_consignado,
      closing_balance: countedTotal,
      notes: counted.notes || '',
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
    { label: 'Dinheiro', value: totals.Dinheiro, cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400 shadow-sm' },
    { label: 'PIX', value: totals.PIX, cls: 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' },
    { label: 'Cartão', value: totals.Cartão, cls: 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm' },
    { label: 'Consignado', value: totals.Consignado, cls: 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' },
  ];

  return (
    <div className="space-y-5">
      {/* Seletor de view — somente gerentes têm Log de Caixa */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm p-1">
          <button onClick={() => setView('current')} className={cn('px-4 py-1.5 text-sm font-medium rounded-md transition-colors', view === 'current' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            Caixa Atual
          </button>
          {isGerente && (
            <button onClick={() => setView('log')} className={cn('inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors', view === 'log' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <History className="w-3.5 h-3.5" /> Log de Caixa
            </button>
          )}
        </div>

        {/* Badge informativo para vendedor */}
        {!isGerente && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full border border-border">
            <Eye className="w-3.5 h-3.5" /> Apenas visualização — operações requerem o gerente
          </span>
        )}
      </div>

      {view === 'log' && isGerente ? (
        <CaixaLog />
      ) : !register ? (
        <div className="bg-white dark:bg-card shadow-sm rounded-2xl border border-slate-200 dark:border-border p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-xl font-semibold">Caixa Fechado</h3>
          {isGerente ? (
            <>
              <p className="text-sm text-muted-foreground mt-1 mb-5">Abra o caixa informando o fundo de troco para iniciar o dia.</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => setPendingAction('open')}><Lock className="w-4 h-4 mr-1.5" /> Abrir Caixa</Button>
                <Button variant="outline" onClick={() => setPendingAction('changePwd')}><Settings className="w-4 h-4 mr-1.5" /> Alterar senha do gerente</Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">O gerente ainda não abriu o caixa hoje. Aguarde para iniciar as operações.</p>
          )}
        </div>
      ) : (
        <>
          {/* Status do caixa */}
          <div className="bg-white dark:bg-card shadow-sm rounded-2xl border border-slate-200 dark:border-border p-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-serif text-lg font-semibold text-slate-900 dark:text-slate-100">Caixa Aberto</p>
                <p className="text-xs text-slate-500 dark:text-muted-foreground">
                  Aberto em {format(new Date(register.opened_at), "dd/MM/yyyy 'às' HH:mm")} por {register.opened_by_name || '—'}
                </p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 font-medium">Aberto</span>
          </div>

          {/* Totais por método */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {methodCards.map(c => (
              <div key={c.label} className={cn('rounded-2xl border p-4', c.cls)}>
                <p className="text-xs opacity-80 mb-1">{c.label}</p>
                <p className="text-lg font-serif font-semibold tabular-nums">{fmt(c.value)}</p>
              </div>
            ))}
            <div className="rounded-2xl border p-4 bg-primary text-primary-foreground">
              <p className="text-xs opacity-80 mb-1">Total em caixa</p>
              <p className="text-lg font-serif font-semibold tabular-nums">{fmt(totals.total)}</p>
            </div>
          </div>

          {/* Botões de ação — somente para gerentes */}
          {isGerente && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setPendingAction('sangria')}><Minus className="w-4 h-4 mr-1.5" /> Sangria (saída)</Button>
              <Button variant="outline" onClick={() => setPendingAction('suprimento')}><Plus className="w-4 h-4 mr-1.5" /> Suprimento (entrada)</Button>
              <Button onClick={() => setPendingAction('close')}><LogOut className="w-4 h-4 mr-1.5" /> Fechar Caixa</Button>
              <Button variant="ghost" onClick={() => setPendingAction('changePwd')}><Settings className="w-4 h-4 mr-1.5" /> Alterar senha</Button>
              <Button variant="outline" onClick={() => setShowImporter(true)}><Upload className="w-4 h-4 mr-1.5" /> Importar Lançamentos</Button>
            </div>
          )}

          <CaixaLedger register={register} movements={movements} sales={sales} />
        </>
      )}

      {/* PasswordModal — somente para ações de gerente */}
      {isGerente && (
        <PasswordModal
          open={!!pendingAction}
          title={TITLES[pendingAction]}
          correctPassword={managerPwd}
          onSuccess={onAuthSuccess}
          onClose={() => setPendingAction(null)}
        />
      )}

      {/* Formulários de gerente */}
      {isGerente && (
        <Dialog open={!!activeForm} onOpenChange={v => { if (!v) setActiveForm(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{TITLES[activeForm]}</DialogTitle></DialogHeader>
            {activeForm === 'open' && <OpenRegisterForm onOpen={openRegister} onClose={() => setActiveForm(null)} />}
            {activeForm === 'sangria' && <MovementForm kind="sangria" onSubmit={d => addMovement({ type: 'sangria', ...d })} onClose={() => setActiveForm(null)} />}
            {activeForm === 'suprimento' && <MovementForm kind="suprimento" onSubmit={d => addMovement({ type: 'suprimento', ...d })} onClose={() => setActiveForm(null)} />}
            {activeForm === 'close' && <CloseConfirmForm totals={totals} onConfirm={closeRegister} onClose={() => setActiveForm(null)} />}
            {activeForm === 'changePwd' && <ChangePasswordForm currentPassword={managerPwd} onChange={changePassword} onClose={() => setActiveForm(null)} />}
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de importação de lançamentos — somente gerentes */}
      {isGerente && (
        <Dialog open={showImporter} onOpenChange={setShowImporter}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Importar Lançamentos do Caixa</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2 mb-2">
              Importe extratos ou lançamentos de sistemas externos (Stone, Cielo, extrato bancário, etc.) para registrá-los nas movimentações do caixa atual.
            </p>
            <ContasImporter onClose={() => { setShowImporter(false); load(); }} onImported={load} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}