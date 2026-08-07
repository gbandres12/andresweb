import { useState } from 'react';
import { Store, Sparkles, CheckCircle, Loader2, ArrowRight, Plus, Building2 } from 'lucide-react';
import { base44, refreshStoreId } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function StoreOnboarding({ onDone }) {
  const { stores, switchStore } = useStore();
  const hasStores = stores.length > 0;
  const [mode, setMode] = useState(hasStores ? 'select' : 'create'); // 'select' | 'create'
  const [form, setForm] = useState({ name: '', cnpj: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(null);
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
      const store = await base44.entities.Store.create({
        name: form.name.trim(),
        cnpj: form.cnpj,
        phone: form.phone,
        email: form.email,
        address: form.address,
        plan: 'free',
        status: 'trial'
      });

      await base44.auth.updateMe({ store_id: store.id, store_role: 'owner' });
      refreshStoreId();

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

  const selectStore = async (s) => {
    setSwitching(s.id);
    try {
      await switchStore(s.id);
      onDone?.(s);
    } catch (err) {
      toast({ title: 'Erro ao acessar loja', description: err.message, variant: 'destructive' });
      setSwitching(null);
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
          <h1 className="font-serif text-3xl font-semibold">
            {mode === 'select' ? 'Acesse sua loja' : 'Configure sua loja'}
          </h1>
        </div>

        {/* Selecionar loja existente */}
        {hasStores && mode === 'select' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Lojas vinculadas</p>
                <p className="text-xs text-muted-foreground">{stores.length} loja(s) disponível(is) para acessar</p>
              </div>
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {stores.map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => selectStore(st)}
                  disabled={!!switching}
                  className="w-full flex items-center justify-between gap-3 border border-border rounded-xl p-3.5 hover:border-primary hover:bg-accent/40 transition-colors text-left disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{st.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {st.cnpj || 'Sem CNPJ'} · <span className="capitalize">{st.status || 'trial'}</span>
                      </p>
                    </div>
                  </div>
                  {switching === st.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                    : <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <Button type="button" variant="outline" className="w-full" onClick={() => setMode('create')}>
                <Plus className="w-4 h-4" /> Criar nova loja
              </Button>
            </div>
          </div>
        )}

        {/* Criar nova loja */}
        {mode === 'create' && (
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

            {hasStores && (
              <button type="button" onClick={() => setMode('select')} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                Acessar loja existente
              </button>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Seus dados existentes serão automaticamente vinculados a esta loja.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}