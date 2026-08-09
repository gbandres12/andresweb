import { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Aluguel', 'Energia', 'Internet', 'Salários', 'Fornecedores', 'Marketing', 'Embalagens', 'Frete', 'Impostos', 'Outros'];

export default function DespesasManager({ expenses, sales, selectedMonth, onMonthChange, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [costCenters, setCostCenters] = useState([]);

  useEffect(() => {
    base44.entities.CostCenter.list('-is_active', 200)
      .then(list => setCostCenters(list || []))
      .catch(() => {});
  }, []);

  const ccName = (id) => costCenters.find(c => c.id === id)?.name;

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return format(d, 'yyyy-MM');
  });

  const monthExpenses = useMemo(() => expenses.filter(e => e.month === selectedMonth), [expenses, selectedMonth]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return monthExpenses;
    return monthExpenses.filter(e => e.type === filterType);
  }, [monthExpenses, filterType]);

  const totalFixed = monthExpenses.filter(e => e.type === 'fixa').reduce((s, e) => s + (e.amount || 0), 0);
  const totalVariable = monthExpenses.filter(e => e.type === 'variável').reduce((s, e) => s + (e.amount || 0), 0);
  const totalExpenses = totalFixed + totalVariable;

  const monthRevenue = sales.filter(s => {
    const m = format(new Date(s.created_date), 'yyyy-MM');
    return s.status === 'concluida' && m === selectedMonth;
  }).reduce((s, sale) => s + (sale.total || 0), 0);

  const netProfit = monthRevenue - totalExpenses;

  const deleteExpense = async (id) => {
    await base44.entities.Expense.delete(id);
    toast.success('Despesa removida');
    onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={onMonthChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => (
              <SelectItem key={m} value={m}>
                {format(new Date(m + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova Despesa
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">Faturamento</p>
          <p className="text-lg font-serif font-semibold text-emerald-700 dark:text-emerald-400">R$ {monthRevenue.toFixed(2).replace('.', ',')}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">Despesas Fixas</p>
          <p className="text-lg font-serif font-semibold text-blue-700">R$ {totalFixed.toFixed(2).replace('.', ',')}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">Despesas Variáveis</p>
          <p className="text-lg font-serif font-semibold text-orange-600">R$ {totalVariable.toFixed(2).replace('.', ',')}</p>
        </div>
        <div className={cn(
          "rounded-2xl border p-4 shadow-sm",
          netProfit >= 0 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900" : "bg-destructive/10 border-destructive/20"
        )}>
          <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">Lucro Líquido</p>
          <p className={cn("text-lg font-serif font-semibold", netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
            R$ {Math.abs(netProfit).toFixed(2).replace('.', ',')}
          </p>
          {netProfit < 0 && <p className="text-xs text-destructive mt-1">⚠ Prejuízo</p>}
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-1">
        {[{ val: 'all', label: 'Todos' }, { val: 'fixa', label: 'Fixas' }, { val: 'variável', label: 'Variáveis' }].map(f => (
          <button
            key={f.val}
            onClick={() => setFilterType(f.val)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              filterType === f.val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-card shadow-sm rounded-2xl border border-slate-200 dark:border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/40">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Descrição</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Categoria</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide hidden md:table-cell">Centro de custo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wide">Valor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b border-slate-200 dark:border-border last:border-0 hover:bg-slate-50 dark:hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{e.description}</p>
                  {e.notes && <p className="text-xs text-slate-500 dark:text-muted-foreground">{e.notes}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-muted-foreground hidden sm:table-cell">{e.category || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-muted-foreground hidden md:table-cell">{ccName(e.cost_center) || '—'}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    e.type === 'fixa' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                  )}>
                    {e.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-serif font-semibold text-destructive text-sm">
                    R$ {(e.amount || 0).toFixed(2).replace('.', ',')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteExpense(e.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12 text-sm">Nenhuma despesa registrada para este mês.</div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Nova Despesa</DialogTitle>
          </DialogHeader>
          <ExpenseForm month={selectedMonth} costCenters={costCenters} onClose={() => { setShowForm(false); onRefresh(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseForm({ month, costCenters, onClose }) {
  const [form, setForm] = useState({ description: '', amount: '', type: 'fixa', category: 'Outros', cost_center: '', notes: '', month });
  const [saving, setSaving] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const save = async () => {
    if (!form.description || !form.amount) { toast.error('Preencha descrição e valor'); return; }
    setSaving(true);
    await base44.entities.Expense.create({ ...form, amount: Number(form.amount) });
    toast.success('Despesa registrada');
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Descrição *</label>
        <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Conta de luz, aluguel..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Valor *</label>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Tipo</label>
          <Select value={form.type} onValueChange={v => set('type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fixa">Fixa</SelectItem>
              <SelectItem value="variável">Variável</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Categoria</label>
        <Select value={form.category} onValueChange={v => set('category', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Centro de custo</label>
        <Select value={form.cost_center || 'none'} onValueChange={v => set('cost_center', v === 'none' ? '' : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {costCenters.filter(c => c.is_active !== false).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
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