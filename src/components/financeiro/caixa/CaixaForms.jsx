import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const METHODS = ['Dinheiro', 'PIX', 'Cartão'];
const fmt = v => 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
const nf = v => (Number(v) || 0).toFixed(2).replace('.', ',');

export function OpenRegisterForm({ onOpen, onClose }) {
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try { await onOpen(Number(balance) || 0); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Fundo de troco (abertura)</label>
        <Input type="number" min="0" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0,00" />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={submit} disabled={saving} className="flex-1">{saving ? 'Abrindo...' : 'Abrir Caixa'}</Button>
      </div>
    </div>
  );
}

export function MovementForm({ kind, onSubmit, onClose }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Dinheiro');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const isSangria = kind === 'sangria';

  const submit = async () => {
    if (!amount || Number(amount) <= 0) { toast.error('Informe um valor válido'); return; }
    if (isSangria && !description.trim()) { toast.error('Informe a descrição da sangria'); return; }
    setSaving(true);
    try { await onSubmit({ amount: Number(amount), payment_method: method, description: description.trim() }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Valor *</label>
        <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Forma de pagamento</label>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Descrição {isSangria ? 'da sangria *' : '(motivo)'}</label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={isSangria ? 'Ex: troco, pagamento a fornecedor...' : 'Ex: reposição de troco'} />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={submit} disabled={saving} className="flex-1">{saving ? 'Salvando...' : isSangria ? 'Registrar Sangria' : 'Registrar Suprimento'}</Button>
      </div>
    </div>
  );
}

export function CloseConfirmForm({ totals, onConfirm, onClose }) {
  const CLOSE_METHODS = ['Dinheiro', 'PIX', 'Cartão', 'Consignado'];
  const [counted, setCounted] = useState({
    Dinheiro: totals?.Dinheiro || 0,
    PIX: totals?.PIX || 0,
    Cartão: totals?.Cartão || 0,
    Consignado: totals?.Consignado || 0,
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const diffOf = m => (Number(counted[m]) || 0) - (totals?.[m] || 0);
  const countedTotal = CLOSE_METHODS.reduce((s, m) => s + (Number(counted[m]) || 0), 0);
  const totalDiff = countedTotal - (totals?.total || 0);

  const confirm = async () => {
    setSaving(true);
    try {
      await onConfirm({
        counted_dinheiro: Number(counted.Dinheiro) || 0,
        counted_pix: Number(counted.PIX) || 0,
        counted_cartao: Number(counted.Cartão) || 0,
        counted_consignado: Number(counted.Consignado) || 0,
        notes: notes.trim(),
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Informe quanto você <strong>contou</strong> de cada forma. A diferença em relação ao esperado fica registrada no log do gerente.</p>
      <div className="space-y-2.5">
        {CLOSE_METHODS.map(m => {
          const d = diffOf(m);
          const ok = Math.abs(d) < 0.005;
          return (
            <div key={m} className="grid grid-cols-12 items-center gap-2">
              <span className="col-span-3 text-sm font-medium">{m}</span>
              <span className="col-span-4 text-[11px] text-muted-foreground tabular-nums">esperado {fmt(totals?.[m] || 0)}</span>
              <Input
                type="number" min="0" step="0.01"
                className="col-span-3 h-8 text-sm tabular-nums"
                value={counted[m]}
                onChange={e => setCounted(c => ({ ...c, [m]: e.target.value }))}
              />
              <span className={cn('col-span-2 text-right text-xs font-medium tabular-nums', ok ? 'text-green-600' : 'text-amber-600')}>
                {ok ? 'ok' : `${d > 0 ? '+' : ''}${nf(d)}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center border-t border-border pt-2.5 text-sm">
        <div>
          <p className="font-serif font-semibold">Total contado <span className="tabular-nums">{fmt(countedTotal)}</span></p>
          <p className="text-xs text-muted-foreground">Esperado geral {fmt(totals?.total || 0)}</p>
        </div>
        <span className={cn('text-sm font-semibold tabular-nums', Math.abs(totalDiff) < 0.005 ? 'text-green-600' : 'text-amber-600')}>
          {Math.abs(totalDiff) < 0.005 ? 'ok' : `diff ${totalDiff > 0 ? '+' : ''}${nf(totalDiff)}`}
        </span>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Observações do fechamento</label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: faltou R$ 10 em dinheiro..." />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={confirm} disabled={saving} className="flex-1">{saving ? 'Fechando...' : 'Confirmar Fechamento'}</Button>
      </div>
    </div>
  );
}

export function ChangePasswordForm({ currentPassword, onChange, onClose }) {
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [confirmP, setConfirmP] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (oldP !== currentPassword) { toast.error('Senha atual incorreta'); return; }
    if (newP.length < 4) { toast.error('A nova senha deve ter ao menos 4 dígitos'); return; }
    if (newP !== confirmP) { toast.error('As senhas não conferem'); return; }
    setSaving(true);
    try { await onChange(newP); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Senha atual</label>
        <Input type="password" value={oldP} onChange={e => setOldP(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Nova senha</label>
        <Input type="password" value={newP} onChange={e => setNewP(e.target.value)} placeholder="Mínimo 4 dígitos" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Confirmar nova senha</label>
        <Input type="password" value={confirmP} onChange={e => setConfirmP(e.target.value)} />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={submit} disabled={saving} className="flex-1">{saving ? 'Salvando...' : 'Alterar Senha'}</Button>
      </div>
    </div>
  );
}