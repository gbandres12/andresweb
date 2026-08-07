import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { Plus, ArrowLeftRight, Printer, Check, X, Truck, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import TransferForm from '@/components/TransferForm';
import TransferVoucher from '@/components/TransferVoucher';

const STATUS = {
  rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
  em_transito: { label: 'Em trânsito', cls: 'bg-amber-100 text-amber-700' },
  recebido: { label: 'Recebido', cls: 'bg-emerald-100 text-emerald-700' },
  parcial: { label: 'Parcial / Perda', cls: 'bg-rose-100 text-rose-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
};

export default function Transferencias() {
  const { store, stores } = useStore();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    base44.entities.Transfer.list('-created_date', 200)
      .then(t => { setTransfers(t); setLoading(false); })
      .catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = transfers.filter(t => statusFilter === 'all' || t.status === statusFilter);
  const counts = transfers.reduce((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {});

  const dispatch = async (t) => {
    setBusy(true);
    try {
      await base44.functions.invoke('transferStock', { action: 'dispatch', transfer_id: t.id });
      toast.success('Guia despachada — estoque saiu da origem');
      load();
    } catch (e) {
      toast.error('Erro ao despachar: ' + (e?.response?.data?.error || e?.message || ''));
    }
    setBusy(false);
  };

  const cancel = async (t) => {
    if (!confirm('Cancelar esta guia? O estoque não será movido.')) return;
    setBusy(true);
    try {
      await base44.entities.Transfer.update(t.id, { status: 'cancelado' });
      toast.success('Guia cancelada');
      load();
    } catch (e) {
      toast.error('Erro: ' + (e?.message || ''));
    }
    setBusy(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-serif font-semibold flex items-center gap-2">
            <ArrowLeftRight className="w-7 h-7 text-primary" /> Transferências
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Distribua estoque da origem para outras lojas — guia rastreada para evitar perdas
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Nova guia</Button>
      </div>

      <div className="bg-accent/40 border border-accent rounded-xl p-3 mb-5 text-sm flex items-center gap-2">
        <Package className="w-4 h-4 text-primary shrink-0" />
        <span>Origem (estoque de saída): <strong>{store?.name || '—'}</strong>. O estoque é decrementado na origem ao despachar e incrementado no destino ao receber.</span>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ v: 'all', l: 'Todas' }, ...Object.entries(STATUS).map(([v, s]) => ({ v, l: s.label }))].map(f => (
          <button
            key={f.v}
            onClick={() => setStatusFilter(f.v)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              statusFilter === f.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.l}{f.v !== 'all' && counts[f.v] ? ` (${counts[f.v]})` : ''}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Guia</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Origem → Destino</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Itens</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const st = STATUS[t.status] || STATUS.rascunho;
              const isOrigin = t.origin_store_id === store?.id;
              const isDest = t.destination_store_id === store?.id;
              return (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <p className="font-medium text-sm">{t.transfer_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.dispatched_at ? new Date(t.dispatched_at).toLocaleDateString('pt-BR') : 'Não despachada'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-foreground">{t.origin_store_name}</span>
                    <span className="text-muted-foreground mx-1.5">→</span>
                    <span className="text-foreground">{t.destination_store_name}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                    {t.total_items || t.items?.length || 0} ({t.total_quantity || 0} un)
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", st.cls)}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      {isOrigin && t.status === 'rascunho' && (
                        <button onClick={() => dispatch(t)} disabled={busy}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" /> Despachar
                        </button>
                      )}
                      {isDest && t.status === 'em_transito' && (
                        <button onClick={() => setReceiving(t)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Receber
                        </button>
                      )}
                      <button onClick={() => setViewing(t)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Ver / Imprimir">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {isOrigin && t.status === 'rascunho' && (
                        <button onClick={() => cancel(t)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Cancelar">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-12">Nenhuma guia de transferência</div>}
      </div>

      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-xl">Nova guia de transferência</DialogTitle></DialogHeader>
          {store && <TransferForm store={store} stores={stores} onClose={() => setShowForm(false)} onSaved={load} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={v => { if (!v) setViewing(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-xl">Guia {viewing?.transfer_number}</DialogTitle></DialogHeader>
          {viewing && <TransferVoucher transfer={viewing} />}
        </DialogContent>
      </Dialog>

      {receiving && <ReceiveDialog transfer={receiving} onClose={() => { setReceiving(null); load(); }} />}
    </div>
  );
}

function ReceiveDialog({ transfer, onClose }) {
  const [received, setReceived] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = {};
    (transfer.items || []).forEach(i => {
      init[`${i.product_id}|${i.variant_size}|${i.variant_color}`] = i.quantity;
    });
    setReceived(init);
  }, [transfer.id]);

  const confirm = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('transferStock', { action: 'receive', transfer_id: transfer.id, received });
      const status = res?.data?.status || 'ok';
      toast.success(status === 'parcial' ? 'Recebimento com diferença registrada (perda)' : 'Recebimento concluído');
      onClose();
    } catch (e) {
      toast.error('Erro ao receber: ' + (e?.response?.data?.error || e?.message || ''));
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-serif text-xl">Receber guia {transfer.transfer_number}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          De <strong>{transfer.origin_store_name}</strong>. Confira as quantidades recebidas — diferenças geram registro de perda.
        </p>
        <div className="space-y-2">
          {(transfer.items || []).map((it, i) => {
            const k = `${it.product_id}|${it.variant_size}|${it.variant_color}`;
            const rv = Number(received[k] ?? 0);
            const diff = rv - it.quantity;
            return (
              <div key={i} className="border border-border rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{it.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.variant_size || '-'} · {it.variant_color || '-'} · Enviado: {it.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min="0" value={rv}
                      onChange={e => setReceived(r => ({ ...r, [k]: Number(e.target.value) }))}
                      className="w-20 text-center"
                    />
                    <span className={cn("text-xs font-medium w-16 text-right", diff < 0 ? "text-rose-600" : diff > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {diff === 0 ? 'confere' : `${diff > 0 ? '+' : ''}${diff}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={confirm} disabled={saving} className="flex-1">{saving ? 'Confirmando...' : 'Confirmar recebimento'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}