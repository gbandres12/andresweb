import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TX_METHOD = { 'Dinheiro': 'Dinheiro', 'PIX': 'PIX', 'Cartão': 'Cartão de Crédito' };

export default function LiquidateDialog({ consignment, onOpenChange, onDone }) {
  const [sold, setSold] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [salesChannel, setSalesChannel] = useState('');
  const [seller, setSeller] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (consignment) {
      const init = {};
      (consignment.items || []).forEach((it, i) => { init[i] = 0; });
      setSold(init);
      setSeller(consignment.consignee_name || '');
      setPaymentMethod('PIX');
      setSalesChannel('');
    }
  }, [consignment]);

  if (!consignment) return null;

  const items = consignment.items || [];
  const soldItems = items.map((it, i) => ({ ...it, soldQty: Number(sold[i] || 0) })).filter(s => s.soldQty > 0);
  const soldTotal = soldItems.reduce((a, s) => a + s.soldQty * s.unit_price, 0);
  const remainingItems = items.map((it, i) => ({ ...it, quantity: it.quantity - Number(sold[i] || 0) })).filter(r => r.quantity > 0);
  const allSold = remainingItems.length === 0 && soldItems.length > 0;

  const save = async () => {
    if (!soldItems.length) { toast.error('Informe a quantidade vendida de ao menos um item'); return; }
    if (!paymentMethod) { toast.error('Selecione o pagamento'); return; }
    setSaving(true);
    try {
      const month = format(new Date(), 'yyyy-MM');
      await base44.entities.Sale.create({
        store_id: consignment.store_id,
        sale_number: `VND-${Date.now().toString().slice(-6)}`,
        items: soldItems.map(s => ({ product_id: s.product_id, product_name: s.product_name, variant_size: s.variant_size, variant_color: s.variant_color, quantity: s.soldQty, unit_price: s.unit_price, total: s.soldQty * s.unit_price })),
        subtotal: soldTotal, total: soldTotal,
        price_table: 'cliente_final',
        payment_method: paymentMethod,
        sales_channel: salesChannel || undefined,
        seller_name: seller || consignment.consignee_name,
        customer_name: consignment.consignee_name,
        status: 'concluida',
        sale_type: 'venda',
      });
      await base44.entities.Transaction.create({
        description: `Venda consignação ${consignment.sale_number}`,
        amount: soldTotal, type: 'receita', category: 'Consignação',
        customer_name: consignment.consignee_name,
        payment_method: TX_METHOD[paymentMethod] || 'Outros',
        status: 'pago', paid_date: format(new Date(), 'yyyy-MM-dd'), month, store_id: consignment.store_id,
      });
      const newTotal = remainingItems.reduce((a, r) => a + r.quantity * r.unit_price, 0);
      await base44.entities.Sale.update(consignment.id, {
        items: remainingItems.map(r => ({ product_id: r.product_id, product_name: r.product_name, variant_size: r.variant_size, variant_color: r.variant_color, quantity: r.quantity, unit_price: r.unit_price, total: r.quantity * r.unit_price })),
        subtotal: newTotal, total: newTotal,
        consignment_status: allSold ? 'liquidada' : 'parcial',
        status: allSold ? 'concluida' : 'pendente',
      });
      toast.success(allSold ? 'Consignação liquidada e venda gerada' : 'Venda parcial registrada');
      onDone?.();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registrar venda');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!consignment} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar venda — {consignment.sale_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-sm text-muted-foreground">Consignatário: <span className="font-medium text-foreground">{consignment.consignee_name}</span></p>
          <div className="space-y-1">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1.5 border-b border-border/60 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground">{[it.variant_size, it.variant_color].filter(Boolean).join(' / ') || 'Único'} · enviado: {it.quantity}</p>
                </div>
                <Input type="number" min="0" max={it.quantity} value={sold[i] ?? 0} onChange={e => setSold({ ...sold, [i]: e.target.value })} className="h-8 w-20 text-sm" />
                <span className="text-xs text-muted-foreground w-8 text-right">/{it.quantity}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">Pagamento *</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Dinheiro', 'PIX', 'Cartão'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Canal</label>
              <Select value={salesChannel} onValueChange={setSalesChannel}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {['Loja Física', 'WhatsApp', 'Instagram', 'Facebook', 'Site / E-commerce', 'Outros'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">Vendedor</label>
            <Input value={seller} onChange={e => setSeller(e.target.value)} className="h-9" />
          </div>
          <div className="flex justify-between bg-muted/40 rounded-lg px-3 py-2 text-sm font-semibold">
            <span>Total vendido</span><span className="tabular-nums text-primary">R$ {soldTotal.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar venda'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}