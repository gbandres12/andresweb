import { db } from './db/database.js';
import assert from 'assert';

async function runTests() {
  console.log('--- Início dos Testes Financeiros e de DB ---');
  
  const storeId1 = 'store-test-1';
  const storeId2 = 'store-test-2';

  // Limpar os dados relacionados para o teste
  const entitiesToTest = ['Sale', 'Expense', 'Transaction', 'CashRegister', 'CashMovement', 'Commission', 'CostCenter', 'ConciliationEntry'];
  
  // Create test items for storeId1 and storeId2
  console.log('1. Criando Entidades com store_id...');
  
  const costCenter1 = db.create('CostCenter', { name: 'Vendas', store_id: storeId1 });
  const costCenter2 = db.create('CostCenter', { name: 'Operacional', store_id: storeId2 });
  
  const cashRegister1 = db.create('CashRegister', { status: 'open', opened_at: new Date().toISOString(), opening_balance: 100, store_id: storeId1 });
  const cashRegister2 = db.create('CashRegister', { status: 'open', opened_at: new Date().toISOString(), opening_balance: 50, store_id: storeId2 });
  
  const cashMovement1 = db.create('CashMovement', { type: 'in', amount: 50, cash_register_id: cashRegister1.id, store_id: storeId1 });
  
  const commission1 = db.create('Commission', { amount: 15, employee_id: 'emp1', store_id: storeId1 });
  
  const sale1 = db.create('Sale', { 
    total: 200, 
    cost: 100, 
    status: 'completed', 
    store_id: storeId1,
    cash_register_id: cashRegister1.id
  });
  
  const expense1 = db.create('Expense', { 
    amount: 30, 
    status: 'paid', 
    store_id: storeId1,
    cost_center_id: costCenter1.id
  });

  const transaction1 = db.create('Transaction', {
    type: 'revenue',
    amount: 200,
    reference_id: sale1.id,
    reference_type: 'sale',
    store_id: storeId1
  });

  const transaction2 = db.create('Transaction', {
    type: 'expense',
    amount: 30,
    reference_id: expense1.id,
    reference_type: 'expense',
    store_id: storeId1
  });

  const conciliationEntry1 = db.create('ConciliationEntry', {
    amount: 200,
    status: 'pending',
    store_id: storeId1
  });

  // Fechamento de caixa
  const cashRegisterClosing = db.update('CashRegister', cashRegister1.id, {
    status: 'closed',
    closed_at: new Date().toISOString(),
    closing_balance: 350 // 100 (abertura) + 50 (movimento) + 200 (venda)
  });

  // Cálculo de Margem e Lucro
  console.log('2. Calculando Margem e Lucro (Simulação)...');
  const revenue = db.filter('Transaction', { store_id: storeId1, type: 'revenue' }).reduce((sum, t) => sum + t.amount, 0);
  const costs = db.filter('Sale', { store_id: storeId1 }).reduce((sum, s) => sum + s.cost, 0);
  const expenses = db.filter('Transaction', { store_id: storeId1, type: 'expense' }).reduce((sum, t) => sum + t.amount, 0);
  
  const grossProfit = revenue - costs;
  const netProfit = grossProfit - expenses;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  console.log(`Receita: ${revenue}`);
  console.log(`Custos (CMV): ${costs}`);
  console.log(`Lucro Bruto: ${grossProfit}`);
  console.log(`Despesas: ${expenses}`);
  console.log(`Lucro Líquido: ${netProfit}`);
  console.log(`Margem de Lucro: ${margin.toFixed(2)}%`);

  assert.strictEqual(revenue, 200, 'Receita deve ser 200');
  assert.strictEqual(costs, 100, 'Custo deve ser 100');
  assert.strictEqual(grossProfit, 100, 'Lucro bruto deve ser 100');
  assert.strictEqual(expenses, 30, 'Despesas deve ser 30');
  assert.strictEqual(netProfit, 70, 'Lucro líquido deve ser 70');
  
  // Validando Filtros de store_id para todas as entidades
  console.log('3. Validando filtros de store_id para todas as entidades financeiras...');
  
  for (const entity of entitiesToTest) {
    const itemsStore1 = db.filter(entity, { store_id: storeId1 });
    const itemsStore2 = db.filter(entity, { store_id: storeId2 });
    
    // Assegura que nenhum item de store1 apareça em store2
    const allStore1HasRightId = itemsStore1.every(i => i.store_id === storeId1);
    const allStore2HasRightId = itemsStore2.every(i => i.store_id === storeId2);
    
    assert.strictEqual(allStore1HasRightId, true, `A entidade ${entity} retornou store_id incorreto para store1`);
    assert.strictEqual(allStore2HasRightId, true, `A entidade ${entity} retornou store_id incorreto para store2`);
    console.log(`[OK] Entidade ${entity} filtrou por store_id com sucesso.`);
  }

  // Cleanup for tests
  console.log('4. Limpeza (Cleanup)...');
  db.delete('CostCenter', costCenter1.id);
  db.delete('CostCenter', costCenter2.id);
  db.delete('CashRegister', cashRegister1.id);
  db.delete('CashRegister', cashRegister2.id);
  db.delete('CashMovement', cashMovement1.id);
  db.delete('Commission', commission1.id);
  db.delete('Sale', sale1.id);
  db.delete('Expense', expense1.id);
  db.delete('Transaction', transaction1.id);
  db.delete('Transaction', transaction2.id);
  db.delete('ConciliationEntry', conciliationEntry1.id);

  console.log('--- Testes Concluídos com Sucesso! ---');
}

runTests().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
