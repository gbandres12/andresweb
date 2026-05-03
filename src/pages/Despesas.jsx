import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Aluguel', 'Energia', 'Internet', 'Salários', 'Fornecedores', 'Marketing', 'Embalagens', 'Frete', 'Impostos', 'Outros'];

export default function Despesas({ monthRevenue }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const load = () => base44.entities.Expense.filter({ month: selectedMonth }, '-created_date').then(e => {
    setExpenses(e);
    setLoading(false);
  });

  useEffect(() => { load(); }, [selectedMonth]);

  const totalFixed = expenses.filter(e => e.type === 'fixa').reduce((s, e) => s + (e.amount || 0), 0);
  const totalVariable = expenses.filter(e => e.type === 'variável').reduce((s, e) => s + (e.amount || 0), 0);
  const totalExpenses = totalFixed + totalVariable;
  const netProfit = (monthRevenue || 0) - totalExpenses;

  const deleteExpense = async (id) => {
    await base44.entities.Expense.delete(id);
    toast.success('Despesa removida');
    load();
  };

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, 'yyyy-MM');
  });

  return (
    <div className="space-y-6">
      {/* Month selector + Add button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-44">
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
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nova Despesa
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={TrendingUp} label="Faturamento" value={monthRevenue || 0} color="green" />
        <SummaryCard icon={TrendingDown} label="Despesas Fixas" value={totalFixed} color="red" />
        <SummaryCard icon={TrendingDown} label="Despesas Variáveis" value={totalVariable} color="orange" />
        <div className={cn(
          "rounded-2xl border p-4",
          netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-destructive/10 border-destructive/20"
        )}>
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2",
            netProfit >= 0 ? "bg-green-100 text-green-700" : "bg-destructive/20 text-destructive"
          )}>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className={cn("text-xl font-serif font-semibold", netProfit >= 0 ? "text-green-700" : "text-destructive")}>
            R$ {Math.abs(netProfit).toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Lucro Líquido</p>
          {netProfit < 0 && <p className="text-xs text-destructive font-medium mt-1">⚠ Prejuízo</p>}
        </div>
      </div>

      {/* Expenses list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-sm">{e.description}</p>
                    {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{e.category || '—'}</td>
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
          {expenses.length === 0 && (
            <div className="text-center text-muted-foreground py-12 text-sm">
              Nenhuma despesa registrada para este mês.
            </div>
          )}
        </div>
      )}

      {/* Add form dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Nova Despesa</DialogTitle>
          </DialogHeader>
          <ExpenseForm month={selectedMonth} onClose={() => { setShowForm(false); load(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-destructive/10 text-destructive border-destructive/20',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };
  const iconColors = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-destructive/20 text-destructive',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className={cn("rounded-2xl border p-4", colors[color])}>
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2", iconColors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl font-serif font-semibold">R$ {value.toFixed(2).replace('.', ',')}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function ExpenseForm({ month, onClose }) {
  const [form, setForm] = useState({ description: '', amount: '', type: 'fixa', category: 'Outros', notes: '', month });
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