import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PackageCheck, Undo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Sale.filter({ sale_type: 'consignacao' }, '-created_date', 200);
      setSales(list || []);
    } catch {
      toast.error('Erro ao carregar consignações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const liquidar = async (sale) => {
    setBusy(sale.id);
    try {
      await base44.entities.Sale.update(sale.id, { status: 'concluida', consignment_status: 'liquidada' });
      const month = format(new Date(), 'yyyy-MM');
      await base44.entities.Transaction.create({
        description: `Liquidação consignação ${sale.sale_number}`,
        amount: sale.total,
        type: 'receita',
        category: 'Consignação',
        customer_name: sale.consignee_name || sale.customer_name || '',
        payment_method: 'Outros',
        status: 'pago',
        paid_date: format(new Date(), 'yyyy-MM-dd'),
        month,
        store_id: sale.store_id,
      });
      toast.success('Consignação liquidada e receita registrada');
      load();
    } catch {
      toast.error('Erro ao liquidar consignação');
    } finally {
      setBusy(null);
    }
  };

  const devolver = async (sale) => {
    setBusy(sale.id);
    try {
      for (const item of (sale.items || [])) {
        const product = await base44.entities.Product.get(item.product_id);
        const variants = (product.variants || []).map(v =>
          (v.size === item.variant_size && v.color === item.variant_color)
            ? { ...v, stock: (v.stock || 0) + (item.quantity || 0) }
            : v
        );
        await base44.entities.Product.update(item.product_id, { variants });
      }
      await base44.entities.Sale.update(sale.id, { status: 'cancelada', consignment_status: 'devolvida' });
      toast.success('Consignação devolvida — estoque reposto');
      load();
    } catch {
      toast.error('Erro ao devolver consignação');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Vendas em Consignação</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Peças enviadas a consignatários. Liquide quando vender ou devolva para repor o estoque.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Em consignação', value: sales.filter(s => s.consignment_status === 'em_consignacao').length, tone: 'text-amber-600' },
          { label: 'Liquidadas', value: sales.filter(s => s.consignment_status === 'liquidada').length, tone: 'text-emerald-600' },
          { label: 'Devolvidas', value: sales.filter(s => s.consignment_status === 'devolvida').length, tone: 'text-muted-foreground' },
          { label: 'Valor em consignação', value: `R$ ${sales.filter(s => s.consignment_status === 'em_consignacao').reduce((a, s) => a + (s.total || 0), 0).toFixed(2).replace('.', ',')}`, tone: 'text-primary' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{k.label}</p>
            <p className={cn("text-2xl font-serif font-semibold mt-1 tabular-nums", k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {sales.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <p className="text-sm">Nenhuma venda em consignação registrada.</p>
            <p className="text-xs mt-1 text-muted-foreground/60">No PDV, marque a opção "Venda em consignação" ao finalizar.</p>
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
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => {
                  const pcs = (s.items || []).reduce((a, i) => a + (i.quantity || 0), 0);
                  const open = s.consignment_status === 'em_consignacao';
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-3 px-5">
                        <p className="font-medium text-foreground">{s.sale_number}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(s.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                      </td>
                      <td className="py-3 px-4 text-foreground">{s.consignee_name || s.customer_name || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{pcs} peça{pcs !== 1 ? 's' : ''}</td>
                      <td className="py-3 px-4 font-semibold text-primary tabular-nums">R$ {(s.total || 0).toFixed(2).replace('.', ',')}</td>
                      <td className="py-3 px-4">
                        <span className={cn("text-xs font-medium rounded-full px-2.5 py-1 border", STATUS_TONE[s.consignment_status] || STATUS_TONE.em_consignacao)}>
                          {STATUS_LABEL[s.consignment_status] || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {open ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => liquidar(s)} disabled={busy === s.id} className="h-8 gap-1.5">
                              <PackageCheck className="w-3.5 h-3.5" /> Liquidar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => devolver(s)} disabled={busy === s.id} className="h-8 gap-1.5 hover:text-destructive hover:border-destructive/40">
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
    </div>
  );
}