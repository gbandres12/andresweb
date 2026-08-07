import { useState } from 'react';
import { Store, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const PLANS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

function slugify(name) {
  const base = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function StoreForm({ open, onClose, onSaved, initial = null }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    type: initial?.type || 'loja',
    cnpj: initial?.cnpj || '',
    phone: initial?.phone || '',
    email: initial?.email || '',
    address: initial?.address || '',
    plan: initial?.plan || 'free',
  }));
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.value ?? e }));

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) { toast.error('Informe o nome da loja'); return; }
    setSaving(true);
    try {
      let store;
      const payload = {
        name: form.name.trim(),
        type: form.type,
        cnpj: form.cnpj,
        phone: form.phone,
        email: form.email,
        address: form.address,
        plan: form.plan,
      };
      if (isEdit) {
        store = await base44.entities.Store.update(initial.id, payload);
      } else {
        store = await base44.entities.Store.create({ ...payload, slug: slugify(form.name), status: 'trial' });
      }
      toast.success(isEdit ? 'Loja atualizada' : 'Loja criada com sucesso');
      onSaved?.(store);
      onClose?.();
    } catch (err) {
      toast.error('Erro: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar loja' : 'Nova loja'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Nome da loja *</Label>
            <Input value={form.name} onChange={set('name')} placeholder="Ex: Boutique Flores" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Tipo</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="loja">Loja (venda)</SelectItem>
                <SelectItem value="deposito">Depósito / Estoque geral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">CNPJ</Label>
              <Input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Telefone</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="(00) 0000-0000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">E-mail</Label>
            <Input type="email" value={form.email} onChange={set('email')} placeholder="contato@sualoja.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Endereço</Label>
            <Input value={form.address} onChange={set('address')} placeholder="Rua, número, cidade" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Plano</Label>
            <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Store className="w-4 h-4 mr-2" />}
              {isEdit ? 'Salvar alterações' : 'Criar loja'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}