import { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, Check, Clock, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ContasImporter from '@/components/financeiro/ContasImporter';

const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Outros'];

export default function ContasManager({ transactions, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [filter, setFilter] = useState('all'); // all | receivable | payable | pending
  const [formType, setFormType] = useState('despesa');
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    base44.entities.Customer.list('-created_date', 200).then(setCustomers).catch(() => {});
  }, []);

  const filtered = useMemo(() => transactions.filter(t => {
    if (filter === 'receivable') return t.type === 'receita';
    if (filter === 'payable') return t.type === 'despesa';
    if (filter === 'pending') return t.status === 'pendente';
    return true;
  }).sort((a, b) => (a.due_date || '9999') > (b.due_date || '9999') ? 1 : -1), [transactions, filter]);

  const totalReceivable = transactions.filter(t => t.type === 'receita' && t.status === 'pendente').reduce((s, t) => s + (t.amount || 0), 0);
  const totalPayable = transactions.filter(t => t.type === 'despesa' && t.status === 'pendente').reduce((s, t) => s + (t.amount || 0), 0);

  const markPaid = async (t) => {
    await base44.entities.Transaction.update(t.id, {
      status: 'pago',
      paid_date: format(new Date(), 'yyyy-MM-dd'),
    });
    toast.success('Marcado como pago');
    onRefresh();
  };

  const deleteTransaction = async (id) => {
    await base44.entities.Transaction.delete(id);
    toast.success('Removido');
    onRefresh();
  };

  const statusIcon = { pago: Check, pendente: Clock, cancelado: X };
  const statusColor = {
    pago: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30',
    pendente: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30',
    cancelado: 'text-slate-500 bg-slate-100 dark:text-muted-foreground dark:bg-muted',
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">A Receber (pendente)</p>
          <p className="text-xl font-serif font-semibold text-emerald-700 dark:text-emerald-400">R$ {totalReceivable.toFixed(2).replace('.', ',')}</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">A Pagar (pendente)</p>
          <p className="text-xl font-serif font-semibold text-destructive">R$ {totalPayable.toFixed(2).replace('.', ',')}</p>
        </div>
      </div>

      {/* Filters + Add */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 flex-wrap">
          {[
            { val: 'all', label: 'Todos' },
            { val: 'receivable', label: 'A Receber' },
            { val: 'payable', label: 'A Pagar' },
            { val: 'pending', label: 'Pendentes' },
          ].map(f => (
            <button
              key={f.val}
              onClick={() => setFilter(f.val)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filter === f.val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowImporter(true)}>
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Importar (IA)
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setFormType('receita'); setShowForm(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> A Receber
          </Button>
          <Button size="sm" onClick={() => { setFormType('despesa'); setShowForm(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> A Pagar
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-card shadow-sm rounded-2xl border border-slate-200 dark:border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-muted/40 border-b border-slate-200 dark:border-border">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Descrição</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide hidden md:table-cell">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const Icon = statusIcon[t.status] || Clock;
              const isOverdue = t.status === 'pendente' && t.due_date && t.due_date < format(new Date(), 'yyyy-MM-dd');
              return (
                <tr key={t.id} className="border-b border-slate-200 dark:border-border last:border-0 hover:bg-slate-50 dark:hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.description}</p>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground">{t.type === 'receita' ? '↑ Receita' : '↓ Despesa'} · {t.category || '—'}</p>
                    {t.customer_name && <p className="text-xs text-emerald-600 dark:text-emerald-500">Cliente: {t.customer_name}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {t.due_date ? (
                      <span className={cn("text-sm", isOverdue ? "text-destructive font-medium" : "text-slate-500 dark:text-muted-foreground")}>
                        {format(new Date(t.due_date + 'T00:00:00'), 'dd/MM/yyyy')}
                        {isOverdue && ' ⚠'}
                      </span>
                    ) : <span className="text-sm text-slate-500 dark:text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-sm font-semibold font-serif", t.type === 'receita' ? "text-emerald-600 dark:text-emerald-500" : "text-destructive")}>
                      {t.type === 'receita' ? '+' : '-'} R$ {(t.amount || 0).toFixed(2).replace('.', ',')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 w-fit", statusColor[t.status])}>
                      <Icon className="w-3 h-3" />
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {t.status === 'pendente' && (
                        <button onClick={() => markPaid(t)} title="Marcar como pago" className="p-1.5 rounded-lg hover:bg-emerald-100 text-slate-500 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 transition-colors">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => deleteTransaction(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12 text-sm">Nenhum lançamento encontrado</div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {formType === 'receita' ? 'Nova Conta a Receber' : 'Nova Conta a Pagar'}
            </DialogTitle>
          </DialogHeader>
          <TransactionForm type={formType} customers={customers} onClose={() => { setShowForm(false); onRefresh(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showImporter} onOpenChange={v => { if (!v) setShowImporter(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Importar Contas com IA
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Envie um PDF, CSV ou Excel — a IA extrai e classifica cada lançamento como receita ou despesa.</p>
          </DialogHeader>
          <ContasImporter onClose={() => setShowImporter(false)} onImported={onRefresh} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransactionForm({ type, customers, onClose }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    type,
    category: '',
    customer_id: '',
    customer_name: '',
    payment_method: 'PIX',
    status: 'pendente',
    due_date: '',
    paid_date: '',
    month: format(new Date(), 'yyyy-MM'),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const save = async () => {
    if (!form.description || !form.amount) { toast.error('Preencha descrição e valor'); return; }
    setSaving(true);
    await base44.entities.Transaction.create({ ...form, amount: Number(form.amount) });
    toast.success('Lançamento criado');
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Descrição *</label>
        <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Nota fiscal fornecedor..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Valor *</label>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Status</label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Vencimento</label>
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Categoria</label>
          <Input value={form.category} onChange={e => set('category', e.target.value)} placeholder="Ex: Fornecedor" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Forma de Pagamento</label>
        <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {type === 'receita' && (
        <div>
          <label className="text-sm font-medium mb-1.5 block">Cliente (para controle de inadimplência)</label>
          <Select
            value={form.customer_id}
            onValueChange={v => {
              const c = (customers || []).find(c => c.id === v);
              set('customer_id', v);
              set('customer_name', c ? c.name : '');
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecione o cliente (opcional)" /></SelectTrigger>
            <SelectContent>
              {(customers || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Observações</label>
        <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Opcional..." />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </div>
  );
}