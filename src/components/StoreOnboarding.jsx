import { useState } from 'react';
import { Store, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { base44, refreshStoreId } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function StoreOnboarding({ onDone }) {
  const [form, setForm] = useState({ name: '', cnpj: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Informe o nome da loja', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // 1. Cria a loja (RLS de create = created_by_id, liberado para o próprio usuário)
      const store = await base44.entities.Store.create({
        name: form.name.trim(),
        cnpj: form.cnpj,
        phone: form.phone,
        email: form.email,
        address: form.address,
        plan: 'free',
        status: 'trial'
      });

      // 2. Vincula a loja ao usuário
      await base44.auth.updateMe({ store_id: store.id, store_role: 'owner' });
      refreshStoreId();

      // 3. Backfill de registros legados (service role, bypassa RLS)
      try {
        await base44.functions.invoke('provisionStore', { store_id: store.id });
      } catch (err) {
        console.warn('Backfill falhou (não bloqueia onboarding):', err);
      }

      toast({ title: 'Loja criada!', description: 'Bem-vinda ao Andres WEB' });
      onDone?.(store);
    } catch (err) {
      toast({ title: 'Erro ao criar loja', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-semibold">Configure sua loja</h1>
        </div>

        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome da loja *</label>
            <Input value={form.name} onChange={update('name')} placeholder="Ex: Boutique Flores" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">CNPJ</label>
              <Input value={form.cnpj} onChange={update('cnpj')} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Telefone</label>
              <Input value={form.phone} onChange={update('phone')} placeholder="(00) 0000-0000" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">E-mail</label>
            <Input type="email" value={form.email} onChange={update('email')} placeholder="contato@sualoja.com" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Endereço</label>
            <Input value={form.address} onChange={update('address')} placeholder="Rua, número, cidade" />
          </div>

          {/* Plano destaque */}
          <div className="bg-accent/40 border border-accent rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-accent-foreground">Plano Free — 14 dias de trial</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Acesso completo ao PDV, estoque, financeiro e clientes. Sem cartão de crédito.
              </p>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full" size="lg">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><CheckCircle className="w-4 h-4" /> Criar minha loja</>}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Seus dados existentes serão automaticamente vinculados a esta loja.
          </p>
        </form>
      </div>
    </div>
  );
}