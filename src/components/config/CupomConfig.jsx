import { useState, useEffect } from 'react';
import { useStore } from '@/lib/StoreContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { getCupomConfig, printControlCupom } from '@/components/pdv/ControlCupom';

const TOGGLES = [
  { key: 'show_store_name', label: 'Nome da loja' },
  { key: 'show_cnpj', label: 'CNPJ' },
  { key: 'show_address', label: 'Endereço' },
  { key: 'show_phone', label: 'Telefone' },
  { key: 'show_date', label: 'Data/hora' },
  { key: 'show_seller', label: 'Vendedor' },
  { key: 'show_customer', label: 'Cliente' },
  { key: 'show_items', label: 'Itens da venda' },
  { key: 'show_payment', label: 'Forma de pagamento' },
];

export default function CupomConfig() {
  const { store, reload } = useStore();
  const [cfg, setCfg] = useState(getCupomConfig(store));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCfg(getCupomConfig(store)); }, [store?.id]);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const save = async () => {
    if (!store?.id) { toast.error('Selecione uma loja'); return; }
    setSaving(true);
    try {
      await base44.entities.Store.update(store.id, {
        settings: { ...(store.settings || {}), cupom: cfg },
      });
      toast.success('Configurações do cupom salvas');
      await reload?.();
    } catch (e) {
      toast.error('Erro ao salvar: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const preview = () => {
    printControlCupom(
      {
        sale_number: 'VND-TESTE',
        created_date: new Date().toISOString(),
        items: [
          { product_name: 'Produto Exemplo', variant_size: 'M', variant_color: 'Preto', quantity: 2, total: 99.80 },
        ],
        subtotal: 99.80, discount: 0, total: 99.80,
        payment_method: 'Dinheiro', seller_name: 'Vendedora Teste', customer_name: 'Cliente Teste',
      },
      { ...store, settings: { ...(store?.settings || {}), cupom: cfg } }
    );
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
        <div>
          <h3 className="font-serif text-lg font-semibold">Cupom de Controle</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure o que aparece no cupom impresso ao concluir uma venda (não é documento fiscal).
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Título do cupom</Label>
            <Input value={cfg.title} onChange={e => set('title', e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Largura (mm)</Label>
            <Input type="number" value={cfg.width_mm} onChange={e => set('width_mm', Number(e.target.value))} className="h-10" />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide mb-2 block">Campos exibidos</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TOGGLES.map(t => (
              <label key={t.key} className="flex items-center gap-2.5 cursor-pointer rounded-lg bg-muted/60 px-3 py-2.5">
                <Switch checked={!!cfg[t.key]} onCheckedChange={v => set(t.key, v)} />
                <span className="text-sm text-foreground">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Mensagem de rodapé</Label>
          <Textarea value={cfg.footer} onChange={e => set('footer', e.target.value)} rows={2} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar configurações
          </Button>
          <Button variant="outline" onClick={preview} className="gap-2">
            <Printer className="w-4 h-4" /> Testar impressão
          </Button>
        </div>
      </div>
    </div>
  );
}