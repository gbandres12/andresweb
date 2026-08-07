import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const METHODS = ['Dinheiro', 'PIX', 'Cartão'];
const fmt = v => 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');

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
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try { await onConfirm(); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted rounded-xl p-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span>Dinheiro</span><span className="font-medium tabular-nums">{fmt(totals.Dinheiro)}</span></div>
        <div className="flex justify-between"><span>PIX</span><span className="font-medium tabular-nums">{fmt(totals.PIX)}</span></div>
        <div className="flex justify-between"><span>Cartão</span><span className="font-medium tabular-nums">{fmt(totals.Cartão)}</span></div>
        <div className="flex justify-between border-t border-border pt-1.5 mt-1.5 font-serif font-semibold"><span>Total Geral</span><span className="tabular-nums">{fmt(totals.total)}</span></div>
      </div>
      <p className="text-xs text-muted-foreground">Confirme o fechamento. Os valores acima serão registrados no caixa.</p>
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