import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Undo2, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import NewConsignationDialog from '@/components/consignacao/NewConsignationDialog';
import PaymentDialog from '@/components/consignacao/PaymentDialog';
import { cancelConsignmentReceivable } from '@/lib/consignment';

const STATUS_LABEL = {
  em_consignacao: 'Em consignação',
  liquidada: 'Liquidada',
  devolvida: 'Devolvida',
  parcial: 'Parcial',
};
const STATUS_TONE = {
  em_consignacao: 'bg-amber-50 text-amber-700 border-amber-200',
  liquidada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  devolvida: 'bg-muted text-muted-foreground border-border',
  parcial: 'bg-sky-50 text-sky-700 border-sky-200',
};

export default function Consignacoes() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState('todos');
  const [newOpen, setNewOpen] = useState(false);
  const [payment, setPayment] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Sale.filter({ sale_type: 'consignacao' }, '-created_date', 200);
      setAll(list || []);
    } catch {
      toast.error('Erro ao carregar consignações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOpen = (c) => c.consignment_status === 'em_consignacao' || c.consignment_status === 'parcial';
  const isOverdue = (c) => c.consignment_due_date && isOpen(c) && parseISO(c.consignment_due_date) < today;

  const openCount = all.filter(isOpen).length;
  const overdueCount = all.filter(isOverdue).length;
  const openValue = all.filter(isOpen).reduce((a, c) => a + (c.total || 0), 0);
  const liquidadaCount = all.filter(c => c.consignment_status === 'liquidada').length;

  const filtered = all.filter(c => {
    if (filter === 'todos') return true;
    if (filter === 'abertas') return isOpen(c);
    if (filter === 'vencidas') return isOverdue(c);
    return c.consignment_status === filter;
  });

  const devolver = async (c) => {
    const pcs = (c.items || []).reduce((a, i) => a + (i.quantity || 0), 0);
    if (!window.confirm(`Devolver ${pcs} peça(s) ao estoque e encerrar esta consignação?`)) return;
    setBusy(c.id);
    try {
      for (const it of (c.items || [])) {
        const prod = await base44.entities.Product.get(it.product_id);
        const variants = (prod.variants || []).map(v =>
          (v.size === it.variant_size && v.color === it.variant_color)
            ? { ...v, stock: (v.stock || 0) + (it.quantity || 0) }
            : v
        );
        await base44.entities.Product.update(it.product_id, { variants });
        await base44.entities.StockMovement.create({
          product_id: it.product_id, product_name: it.product_name,
          variant_size: it.variant_size, variant_color: it.variant_color,
          type: 'entrada', quantity: it.quantity, reason: 'Devolução consignação', store_id: c.store_id,
        });
      }
      await base44.entities.Sale.update(c.id, { consignment_status: 'devolvida', status: 'cancelada' });
      try { await cancelConsignmentReceivable(c.sale_number); } catch { /* ignore */ }
      toast.success('Itens devolvidos ao estoque');
      load();
    } catch {
      toast.error('Erro ao devolver');
    } finally {
      setBusy(null);
    }
  };

  const deadlineBadge = (c) => {
    if (!c.consignment_due_date) return { label: 'Sem prazo', tone: 'bg-muted text-muted-foreground border-border' };
    const due = parseISO(c.consignment_due_date);
    if (isOpen(c)) {
      const days = differenceInCalendarDays(due, today);
      if (days < 0) return { label: 'Vencido', tone: 'bg-red-50 text-red-700 border-red-200' };
      if (days <= 7) return { label: `Vence em ${days}d`, tone: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: format(due, 'dd/MM/yyyy'), tone: 'bg-muted text-muted-foreground border-border' };
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">Consignações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registre produtos enviados a parceiros, controle o prazo e converta o que foi vendido em venda.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-1" /> Nova Consignação</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Em consignação', value: openCount, tone: 'text-amber-600' },
          { label: 'Vencidas', value: overdueCount, tone: 'text-red-600' },
          { label: 'Valor em consignação', value: `R$ ${openValue.toFixed(2).replace('.', ',')}`, tone: 'text-primary' },
          { label: 'Liquidadas', value: liquidadaCount, tone: 'text-emerald-600' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{k.label}</p>
            <p className={cn("text-2xl font-serif font-semibold mt-1 tabular-nums", k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-medium">Filtrar:</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="abertas">Em aberto</SelectItem>
            <SelectItem value="vencidas">Vencidas</SelectItem>
            <SelectItem value="parcial">Parciais</SelectItem>
            <SelectItem value="liquidada">Liquidadas</SelectItem>
            <SelectItem value="devolvida">Devolvidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <p className="text-sm">Nenhuma consignação neste filtro.</p>
            <p className="text-xs mt-1 text-muted-foreground/60">Clique em "Nova Consignação" para registrar o envio de produtos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-muted-foreground">
                  <th className="py-3 px-5 font-medium">Nº / Data</th>
                  <th className="py-3 px-4 font-medium">Consignatário</th>
                  <th className="py-3 px-4 font-medium">Peças</th>
                  <th className="py-3 px-4 font-medium">Total</th>
                  <th className="py-3 px-4 font-medium">Pago</th>
                  <th className="py-3 px-4 font-medium">Saldo</th>
                  <th className="py-3 px-4 font-medium">Prazo</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const pcs = (c.items || []).reduce((a, i) => a + (i.quantity || 0), 0);
                  const paid = (c.consignment_payments || []).reduce((a, p) => a + (p.amount || 0), 0);
                  const balance = Math.max(0, (c.total || 0) - paid);
                  const open = isOpen(c);
                  const badge = deadlineBadge(c);
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-3 px-5">
                        <p className="font-medium text-foreground">{c.sale_number}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(c.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                      </td>
                      <td className="py-3 px-4 text-foreground">{c.consignee_name || c.customer_name || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{pcs}</td>
                      <td className="py-3 px-4 font-semibold text-primary tabular-nums">R$ {(c.total || 0).toFixed(2).replace('.', ',')}</td>
                      <td className="py-3 px-4 text-emerald-700 tabular-nums">R$ {paid.toFixed(2).replace('.', ',')}</td>
                      <td className="py-3 px-4 text-destructive tabular-nums">R$ {balance.toFixed(2).replace('.', ',')}</td>
                      <td className="py-3 px-4">
                        <span className={cn("text-xs font-medium rounded-full px-2.5 py-1 border", badge.tone)}>{badge.label}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn("text-xs font-medium rounded-full px-2.5 py-1 border", STATUS_TONE[c.consignment_status] || STATUS_TONE.em_consignacao)}>
                          {STATUS_LABEL[c.consignment_status] || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {open ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => setPayment(c)} disabled={busy === c.id} className="h-8 gap-1.5">
                              <Wallet className="w-3.5 h-3.5" /> Pagamento
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => devolver(c)} disabled={busy === c.id} className="h-8 gap-1.5 hover:text-destructive hover:border-destructive/40">
                              <Undo2 className="w-3.5 h-3.5" /> Devolver
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground block text-right">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewConsignationDialog open={newOpen} onOpenChange={setNewOpen} onCreated={load} />
      <PaymentDialog consignment={payment} onOpenChange={setPayment} onDone={load} />
    </div>
  );
}