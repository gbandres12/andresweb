import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useStore } from '@/lib/StoreContext';
import { DEFAULT_PAYMENT_METHOD_CONFIG, getStorePaymentMethods } from '@/lib/priceTables';

export default function PaymentMethodsManager() {
  const { store, reload } = useStore();
  const { toast } = useToast();
  const [config, setConfig] = useState(DEFAULT_PAYMENT_METHOD_CONFIG.map(d => ({ ...d })));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setConfig(getStorePaymentMethods(store)); }, [store]);

  const update = (value, label) => setConfig(prev => prev.map(m => m.value === value ? { ...m, label } : m));
  const dirty = JSON.stringify(config) !== JSON.stringify(getStorePaymentMethods(store));

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = config.map(m => ({ value: m.value, label: (m.label || '').trim() || m.value }));
      const settings = { ...(store?.settings || {}), payment_methods: cleaned };
      await base44.entities.Store.update(store.id, { settings });
      toast({ title: 'Formas de pagamento salvas', description: 'Os novos nomes aparecem no caixa.' });
      await reload();
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Formas de Pagamento</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Personalize o nome exibido no caixa para cada forma. O nome interno (à esquerda) fica oculto para o cliente —
            útil para não revelar qual tabela/método está sendo aplicado.
          </p>
        </div>
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {config.map(m => (
          <div key={m.value} className="rounded-xl border border-border p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">{m.value}</p>
            <Input value={m.label} onChange={e => update(m.value, e.target.value)} placeholder={m.value} className="h-9" />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        A forma <strong>Consignação</strong> gera uma fatura sequencial (FAT-AAAA-NNNN) vinculada ao cliente, que pode ser abatida
        na tela de Consignações.
      </p>
    </div>
  );
}