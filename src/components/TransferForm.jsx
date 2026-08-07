import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Plus, Trash2, ChevronDown, ChevronUp, Truck, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function TransferForm({ store, stores, onClose, onSaved }) {
  const [destinationId, setDestinationId] = useState('');
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState({});
  const [qty, setQty] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { base44.entities.Product.list().then(setProducts); }, []);

  const destinations = stores.filter(s => s.id !== store?.id);
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.gtin?.includes(search)
  );

  const setQuantity = (pid, size, color, val) => {
    setQty(q => ({ ...q, [`${pid}-${size}-${color}`]: Math.max(0, Number(val) || 0) }));
  };

  const addVariant = (p, v) => {
    const k = `${p.id}-${v.size}-${v.color}`;
    const q = Number(qty[k] || 0);
    if (!q) { toast.error('Informe a quantidade'); return; }
    if (q > (v.stock || 0)) { toast.error(`Estoque disponível: ${v.stock || 0}`); return; }
    setItems(prev => {
      const exists = prev.find(i => i.product_id === p.id && i.variant_size === v.size && i.variant_color === v.color);
      if (exists) return prev.map(i => i === exists ? { ...i, quantity: i.quantity + q } : i);
      return [...prev, {
        product_id: p.id,
        product_name: p.name,
        sku: p.sku,
        gtin: p.gtin,
        variant_size: v.size,
        variant_color: v.color,
        quantity: q,
        received_quantity: 0,
      }];
    });
    setQty(q => ({ ...q, [k]: 0 }));
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const save = async (andDispatch) => {
    if (!destinationId) { toast.error('Selecione a loja de destino'); return; }
    if (!items.length) { toast.error('Adicione ao menos um item'); return; }
    setSaving(true);
    try {
      const dest = stores.find(s => s.id === destinationId);
      const number = `TRF-${Date.now().toString().slice(-6)}`;
      const transfer = await base44.entities.Transfer.create({
        store_id: store.id,
        transfer_number: number,
        origin_store_id: store.id,
        origin_store_name: store.name,
        destination_store_id: destinationId,
        destination_store_name: dest.name,
        items,
        status: 'rascunho',
        total_items: items.length,
        total_quantity: items.reduce((s, i) => s + i.quantity, 0),
        notes,
      });
      if (andDispatch) {
        await base44.functions.invoke('transferStock', { action: 'dispatch', transfer_id: transfer.id });
      }
      toast.success(andDispatch ? 'Guia criada e despachada' : 'Guia salva como rascunho');
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error('Erro: ' + (e?.response?.data?.error || e?.message || ''));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Origem</Label>
          <div className="text-sm font-medium px-3 py-2.5 rounded-lg bg-muted border border-border">{store.name}</div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Destino *</Label>
          <Select value={destinationId} onValueChange={setDestinationId}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {destinations.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.type === 'deposito' ? ' (depósito)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="relative p-3 border-b border-border">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produto para adicionar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.map(p => {
            const open = expanded[p.id];
            return (
              <div key={p.id} className="border-b border-border last:border-0">
                <button
                  type="button"
                  onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku || p.gtin || p.category}</p>
                  </div>
                  {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 space-y-1.5 bg-muted/20">
                    {(p.variants || []).map((v, i) => {
                      const k = `${p.id}-${v.size}-${v.color}`;
                      return (
                        <div key={i} className="flex items-center gap-2 bg-card rounded-lg px-2.5 py-1.5 border border-border">
                          <span className="text-xs flex-1">
                            {v.size || '-'} · {v.color || '-'} ·{' '}
                            <span className={cn("font-medium", (v.stock || 0) <= 3 ? "text-amber-600" : "text-muted-foreground")}>
                              {v.stock || 0} un
                            </span>
                          </span>
                          <Input type="number" min="0" value={qty[k] || ''} onChange={e => setQuantity(p.id, v.size, v.color, e.target.value)} className="w-16 h-8 text-center text-sm" placeholder="0" />
                          <Button size="sm" variant="outline" type="button" onClick={() => addVariant(p, v)} className="h-8 px-2"><Plus className="w-3.5 h-3.5" /></Button>
                        </div>
                      );
                    })}
                    {!p.variants?.length && <p className="text-xs text-muted-foreground py-2">Sem variantes cadastradas</p>}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto</p>}
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Itens da guia ({items.length})</Label>
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 border border-border rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {it.variant_size || '-'} · {it.variant_color || '-'}{it.sku ? ` · ${it.sku}` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-primary">{it.quantity}</span>
              <button type="button" onClick={() => removeItem(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide">Observações</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas para a guia..." />
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="outline" type="button" onClick={() => save(false)} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" /> Salvar rascunho
        </Button>
        <Button type="button" onClick={() => save(true)} disabled={saving} className="flex-1">
          <Truck className="w-4 h-4 mr-2" /> Salvar e despachar
        </Button>
      </div>
    </div>
  );
}