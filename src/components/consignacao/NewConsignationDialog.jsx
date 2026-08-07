import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const variantKey = (v) => `${v.size || ''}|${v.color || ''}`;

export default function NewConsignationDialog({ open, onOpenChange, onCreated }) {
  const { store } = useStore();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [consignee, setConsignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState([]);
  const [pick, setPick] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    base44.entities.Product.list('-created_date', 100).then(setProducts).catch(() => {});
  }, [open]);

  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  const addItem = (p) => {
    const ps = pick[p.id] || { variantKey: '', qty: 1 };
    const variants = p.variants || [];
    let size = '', color = '';
    if (variants.length > 0) {
      if (!ps.variantKey) { toast.error('Selecione a variação'); return; }
      [size, color] = ps.variantKey.split('|');
    }
    const qty = Number(ps.qty || 1);
    if (!qty || qty < 1) { toast.error('Quantidade inválida'); return; }
    const existing = items.find(i => i.product_id === p.id && i.variant_size === size && i.variant_color === color);
    if (existing) {
      setItems(items.map(i => i === existing ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      setItems([...items, { product_id: p.id, product_name: p.name, variant_size: size, variant_color: color, quantity: qty, unit_price: p.price }]);
    }
    setPick({ ...pick, [p.id]: { variantKey: '', qty: 1 } });
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const total = items.reduce((a, i) => a + i.quantity * i.unit_price, 0);

  const save = async () => {
    if (!consignee.trim()) { toast.error('Informe o consignatário'); return; }
    if (!items.length) { toast.error('Adicione ao menos um produto'); return; }
    if (!dueDate) { toast.error('Defina o prazo de devolução'); return; }
    setSaving(true);
    try {
      const saleNumber = `CON-${Date.now().toString().slice(-6)}`;
      for (const it of items) {
        const prod = products.find(p => p.id === it.product_id) || await base44.entities.Product.get(it.product_id);
        const variants = (prod.variants || []).map(v =>
          (v.size === it.variant_size && v.color === it.variant_color)
            ? { ...v, stock: Math.max(0, (v.stock || 0) - it.quantity) }
            : v
        );
        await base44.entities.Product.update(it.product_id, { variants });
        await base44.entities.StockMovement.create({
          product_id: it.product_id, product_name: it.product_name,
          variant_size: it.variant_size, variant_color: it.variant_color,
          type: 'saida', quantity: it.quantity, reason: 'Consignação', store_id: store?.id,
        });
      }
      await base44.entities.Sale.create({
        store_id: store?.id,
        sale_number: saleNumber,
        items: items.map(i => ({ ...i, total: i.quantity * i.unit_price })),
        subtotal: total, total,
        sale_type: 'consignacao',
        consignment_status: 'em_consignacao',
        status: 'pendente',
        consignee_name: consignee.trim(),
        consignment_due_date: dueDate,
        customer_name: consignee.trim(),
      });
      toast.success('Consignação registrada');
      setConsignee(''); setDueDate(''); setItems([]); setSearch(''); setPick({});
      onCreated?.();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registrar consignação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Nova Consignação</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">Consignatário (parceiro) *</label>
              <Input value={consignee} onChange={e => setConsignee(e.target.value)} placeholder="Nome do parceiro" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Prazo de devolução *</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1 block">Produtos enviados</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
            </div>
            <div className="mt-2 space-y-2">
              {filtered.map(p => {
                const variants = p.variants || [];
                const ps = pick[p.id] || { variantKey: '', qty: 1 };
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">R$ {(p.price || 0).toFixed(2).replace('.', ',')}</p>
                    </div>
                    {variants.length > 0 && (
                      <Select value={ps.variantKey} onValueChange={v => setPick({ ...pick, [p.id]: { ...ps, variantKey: v } })}>
                        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Variação" /></SelectTrigger>
                        <SelectContent>
                          {variants.map(v => <SelectItem key={variantKey(v)} value={variantKey(v)}>{v.size || 'Único'} / {v.color || 'Única'} ({v.stock || 0})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Input type="number" min="1" value={ps.qty} onChange={e => setPick({ ...pick, [p.id]: { ...ps, qty: e.target.value } })} className="h-8 w-16 text-sm" />
                    <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => addItem(p)}><Plus className="w-4 h-4" /></Button>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto encontrado.</p>}
            </div>
          </div>

          {items.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 border-b border-border/60 last:border-0 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{it.product_name}</p>
                    <p className="text-xs text-muted-foreground">{[it.variant_size, it.variant_color].filter(Boolean).join(' / ') || 'Único'}</p>
                  </div>
                  <span className="text-muted-foreground">{it.quantity}x</span>
                  <span className="font-medium tabular-nums">R$ {(it.quantity * it.unit_price).toFixed(2).replace('.', ',')}</span>
                  <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 bg-muted/40 font-semibold text-sm">
                <span>Total enviado</span><span className="tabular-nums">R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar consignação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}