import { base44 } from '@/api/base44Client';

// Descrição fixa usada para localizar a conta a receber (recebível) de uma consignação
export const receivableDesc = (saleNumber) => `Receber consignação ${saleNumber}`;

const monthOf = (date) => (date ? String(date).slice(0, 7) : new Date().toISOString().slice(0, 7));

// Cria a conta a receber (receita pendente) pelo valor total da consignação.
// Pendente não entra no fluxo de caixa; aparece em "A Receber" e é abatida pelas parcelas.
export async function createConsignmentReceivable({ storeId, saleNumber, total, consigneeName, customerId, dueDate }) {
  try {
    return await base44.entities.Transaction.create({
      store_id: storeId,
      description: receivableDesc(saleNumber),
      amount: Number(total) || 0,
      type: 'receita',
      category: 'Consignação',
      customer_name: consigneeName || undefined,
      customer_id: customerId || undefined,
      status: 'pendente',
      due_date: dueDate || undefined,
      month: monthOf(dueDate),
    });
  } catch {
    return null;
  }
}

// Abate um pagamento parcial do recebível. Quando zera, cancela (receita realizada nos pagamentos "pago").
export async function adjustReceivableOnPayment(saleNumber, paymentAmount) {
  try {
    const list = await base44.entities.Transaction.filter(
      { description: receivableDesc(saleNumber), status: 'pendente' },
      '-created_date',
      10
    );
    const rec = (list || [])[0];
    if (!rec) return;
    const remaining = (rec.amount || 0) - (Number(paymentAmount) || 0);
    if (remaining <= 0.01) {
      await base44.entities.Transaction.update(rec.id, { status: 'cancelado', amount: 0 });
    } else {
      await base44.entities.Transaction.update(rec.id, { amount: remaining });
    }
  } catch {
    /* ignore */
  }
}

// Cancela o recebível (usado na devolução total — nada a receber)
export async function cancelConsignmentReceivable(saleNumber) {
  try {
    const list = await base44.entities.Transaction.filter(
      { description: receivableDesc(saleNumber), status: 'pendente' },
      '-created_date',
      10
    );
    for (const t of list || []) {
      await base44.entities.Transaction.update(t.id, { status: 'cancelado' });
    }
  } catch {
    /* ignore */
  }
}