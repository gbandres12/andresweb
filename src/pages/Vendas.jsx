import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function Vendas() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    base44.entities.Sale.list('-created_date', 200).then(s => { setSales(s); setLoading(false); });
  }, []);

  const filtered = sales.filter(s => {
    const matchSearch = !search || 
      s.sale_number?.includes(search) || 
      s.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered.filter(s => s.status === 'concluida').reduce((sum, s) => sum + (s.total || 0), 0);

  const statusColor = {
    concluida: 'bg-green-100 text-green-700',
    cancelada: 'bg-destructive/10 text-destructive',
    pendente: 'bg-amber-100 text-amber-700',
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-semibold">Histórico de Vendas</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} vendas · Total: R$ {totalRevenue.toFixed(2)}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por número ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Nº Venda</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Data</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Total</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Pagamento</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(sale => (
              <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(sale)}>
                <td className="px-5 py-3 text-sm font-mono font-medium text-primary">{sale.sale_number}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                  {format(new Date(sale.created_date), "dd/MM/yy HH:mm", { locale: ptBR })}
                </td>
                <td className="px-4 py-3 text-sm hidden sm:table-cell">{sale.customer_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">R$ {sale.total?.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{sale.payment_method}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-1 rounded-full font-medium capitalize", statusColor[sale.status] || 'bg-muted text-muted-foreground')}>
                    {sale.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12">Nenhuma venda encontrada</div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Venda #{selected?.sale_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Data</p><p>{format(new Date(selected.created_date), "dd/MM/yyyy HH:mm")}</p></div>
                <div><p className="text-muted-foreground text-xs">Pagamento</p><p>{selected.payment_method}</p></div>
                <div><p className="text-muted-foreground text-xs">Cliente</p><p>{selected.customer_name || '—'}</p></div>
                <div><p className="text-muted-foreground text-xs">Telefone</p><p>{selected.customer_phone || '—'}</p></div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground">Produto</th>
                      <th className="text-right px-3 py-2 text-xs text-muted-foreground">Qtd</th>
                      <th className="text-right px-3 py-2 text-xs text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items?.map((item, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-sm">
                          {item.product_name}
                          <p className="text-xs text-muted-foreground">{item.variant_size} · {item.variant_color}</p>
                        </td>
                        <td className="px-3 py-2 text-sm text-right">{item.quantity}x</td>
                        <td className="px-3 py-2 text-sm text-right font-medium">R$ {item.total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-muted rounded-xl p-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>R$ {selected.subtotal?.toFixed(2)}</span></div>
                {selected.discount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>- R$ {selected.discount?.toFixed(2)}</span></div>}
                <div className="flex justify-between font-semibold font-serif text-base border-t border-border pt-1"><span>Total</span><span>R$ {selected.total?.toFixed(2)}</span></div>
              </div>

              {selected.notes && <p className="text-sm text-muted-foreground">Obs: {selected.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}