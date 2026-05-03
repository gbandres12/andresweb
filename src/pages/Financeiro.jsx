import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FinanceiroDashboard from '@/components/financeiro/FinanceiroDashboard';
import FluxoCaixa from '@/components/financeiro/FluxoCaixa';
import ContasManager from '@/components/financeiro/ContasManager';
import DespesasManager from '@/components/financeiro/DespesasManager';

export default function Financeiro() {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const loadAll = () => {
    Promise.all([
      base44.entities.Sale.list('-created_date', 500),
      base44.entities.Expense.list('-created_date', 500),
      base44.entities.Transaction.list('-created_date', 500),
    ]).then(([s, e, t]) => {
      setSales(s);
      setExpenses(e);
      setTransactions(t);
      setLoading(false);
    });
  };

  useEffect(() => { loadAll(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-semibold">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gestão financeira completa do negócio</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <FinanceiroDashboard
            sales={sales}
            expenses={expenses}
            transactions={transactions}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </TabsContent>

        <TabsContent value="fluxo">
          <FluxoCaixa sales={sales} expenses={expenses} transactions={transactions} />
        </TabsContent>

        <TabsContent value="contas">
          <ContasManager transactions={transactions} onRefresh={loadAll} />
        </TabsContent>

        <TabsContent value="despesas">
          <DespesasManager
            expenses={expenses}
            sales={sales}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            onRefresh={loadAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}