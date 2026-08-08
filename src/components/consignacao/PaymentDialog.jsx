import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TX_METHOD = { 'Dinheiro': 'Dinheiro', 'PIX': 'PIX', 'Cartão': 'Cartão de Crédito', 'Transferência': 'Transferência' };

export default function PaymentDialog({ consignment, onOpenChange, onDone }) {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('PIX');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (consignment) {
      const paid = (consignment.consignment_payments || []).reduce((a, p) => a + (p.amount || 0), 0);
      setAmount(Math.max(0, (consignment.total || 0) - paid));
      setMethod('PIX');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
    }
  }, [consignment]);

  if (!consignment) return null;

  const payments = consignment.consignment_payments || [];
  const paid = payments.reduce((a, p) => a + (p.amount || 0), 0);
  const total = consignment.total || 0;
  const balance = Math.max(0, total - paid);

  const save = async () => {
    const v = Number(amount) || 0;
    if (v <= 0) { toast.error('Informe o valor do pagamento'); return; }
    if (v > balance + 0.01) { toast.error(`Valor maior que o saldo (R$ ${balance.toFixed(2).replace('.', ',')})`); return; }
    setSaving(true);
    try {
      const newPayments = [...payments, { amount: v, method, date, notes: notes.trim() }];
      const newPaid = paid + v;
      const fullyPaid = newPaid >= total - 0.01;
      await base44.entities.Sale.update(consignment.id, {
        consignment_payments: newPayments,
        consignment_paid: newPaid,
        consignment_status: fullyPaid ? 'liquidada' : 'parcial',
        status: fullyPaid ? 'concluida' : 'pendente',
      });
      try {
        await base44.entities.Transaction.create({
          store_id: consignment.store_id,
          description: `Pagamento consignação ${consignment.sale_number}`,
          amount: v, type: 'receita', category: 'Consignação',
          customer_name: consignment.consignee_name,
          customer_id: consignment.customer_id || undefined,
          payment_method: TX_METHOD[method] || 'Outros',
          status: 'pago', paid_date: date,
          month: date.slice(0, 7),
        });
      } catch { /* ignore */ }
      toast.success(fullyPaid ? 'Consignação liquidada' : 'Pagamento registrado');
      onDone?.();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registrar pagamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!consignment} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagamento — {consignment.sale_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-sm text-muted-foreground">Consignatário: <span className="font-medium text-foreground">{consignment.consignee_name}</span></p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-[11px] text-muted-foreground uppercase">Total</p>
              <p className="text-sm font-semibold tabular-nums">R$ {total.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2">
              <p className="text-[11px] text-emerald-700 uppercase">Pago</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-700">R$ {paid.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-[11px] text-red-700 uppercase">Saldo</p>
              <p className="text-sm font-semibold tabular-nums text-red-700">R$ {balance.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">Histórico de pagamentos</div>
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 border-t border-border/60 text-sm">
                  <div>
                    <p className="font-medium text-foreground">R$ {(p.amount || 0).toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs text-muted-foreground">{p.method || '—'} · {p.date ? format(new Date(p.date), 'dd/MM/yyyy') : '—'}</p>
                  </div>
                  {p.notes && <span className="text-xs text-muted-foreground italic">{p.notes}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground">Novo pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">Valor (R$) *</label>
                <Input type="number" min="0" step="0.01" value={amount || ''} onChange={e => setAmount(Number(e.target.value) || 0)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Forma *</label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Dinheiro', 'PIX', 'Cartão', 'Transferência'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Data</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Observação</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: 1ª parcela" className="h-9" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}