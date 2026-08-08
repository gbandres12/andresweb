import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Search, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getStoreTables, effectivePrice } from '@/lib/priceTables';
import { createConsignmentReceivable, adjustReceivableOnPayment } from '@/lib/consignment';

const variantKey = (v) => `${v.size || ''}|${v.color || ''}`;

export default function NewConsignationDialog({ open, onOpenChange, onCreated }) {
  const { store } = useStore();
  const tables = getStoreTables(store);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [consigneeName, setConsigneeName] = useState('');
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [priceTable, setPriceTable] = useState(tables[0]?.key || 'cliente_final');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState([]);
  const [pick, setPick] = useState({});
  const [initialPayment, setInitialPayment] = useState(0);
  const [initialMethod, setInitialMethod] = useState('PIX');
  const [saving, setSaving] = useState(false);
  const [addingCust, setAddingCust] = useState(false);

  useEffect(() => {
    if (!open) return;
    base44.entities.Product.list('-created_date', 100).then(setProducts).catch(() => {});
    base44.entities.Customer.list('-created_date', 200).then(setCustomers).catch(() => {});
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
    const unit = effectivePrice(p, priceTable, tables);
    const existing = items.find(i => i.product_id === p.id && i.variant_size === size && i.variant_color === color);
    if (existing) {
      setItems(items.map(i => i === existing ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.unit_price } : i));
    } else {
      setItems([...items, { product_id: p.id, product_name: p.name, variant_size: size, variant_color: color, quantity: qty, unit_price: unit, total: qty * unit }]);
    }
    setPick({ ...pick, [p.id]: { variantKey: '', qty: 1 } });
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const total = items.reduce((a, i) => a + i.total, 0);

  const addCustomer = async () => {
    if (!newCustName.trim()) { toast.error('Informe o nome do cliente'); return; }
    setAddingCust(true);
    try {
      const c = await base44.entities.Customer.create({ name: newCustName.trim(), phone: newCustPhone.trim(), store_id: store?.id });
      setCustomers([c, ...customers]);
      setSelectedCustomerId(c.id);
      setConsigneeName(c.name);
      setShowNewCust(false);
      setNewCustName(''); setNewCustPhone('');
      toast.success('Cliente cadastrado');
    } catch { toast.error('Erro ao cadastrar cliente'); }
    finally { setAddingCust(false); }
  };

  const save = async () => {
    if (!consigneeName.trim()) { toast.error('Selecione ou cadastre o consignatário'); return; }
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
      const paid = Number(initialPayment) || 0;
      const fullyPaid = paid > 0 && paid >= total;
      const consPayments = paid > 0 ? [{ amount: paid, method: initialMethod, date: format(new Date(), 'yyyy-MM-dd') }] : [];
      await base44.entities.Sale.create({
        store_id: store?.id,
        sale_number: saleNumber,
        items: items.map(i => ({ product_id: i.product_id, product_name: i.product_name, variant_size: i.variant_size, variant_color: i.variant_color, quantity: i.quantity, unit_price: i.unit_price, total: i.total })),
        subtotal: total, total,
        price_table: priceTable,
        sale_type: 'consignacao',
        consignment_status: fullyPaid ? 'liquidada' : 'em_consignacao',
        status: fullyPaid ? 'concluida' : 'pendente',
        consignment_payments: consPayments,
        consignment_paid: paid,
        consignee_name: consigneeName.trim(),
        customer_id: selectedCustomerId || undefined,
        customer_name: consigneeName.trim(),
        consignment_due_date: dueDate,
      });
      try { await createConsignmentReceivable({ storeId: store?.id, saleNumber, total, consigneeName: consigneeName.trim(), customerId: selectedCustomerId || undefined, dueDate }); } catch { /* ignore */ }
      if (paid > 0) {
        try {
          await base44.entities.Transaction.create({
            store_id: store?.id,
            description: `Pagamento consignação ${saleNumber}`,
            amount: paid, type: 'receita', category: 'Consignação',
            customer_name: consigneeName.trim(),
            customer_id: selectedCustomerId || undefined,
            payment_method: initialMethod === 'Cartão' ? 'Cartão de Crédito' : initialMethod,
            status: 'pago', paid_date: format(new Date(), 'yyyy-MM-dd'),
            month: format(new Date(), 'yyyy-MM'),
          });
          await adjustReceivableOnPayment(saleNumber, paid);
        } catch { /* ignore */ }
      }
      toast.success(fullyPaid ? 'Consignação registrada e liquidada' : 'Consignação registrada');
      setConsigneeName(''); setSelectedCustomerId(''); setDueDate(''); setItems([]); setSearch(''); setPick({}); setShowNewCust(false); setNewCustName(''); setNewCustPhone(''); setInitialPayment(0); setInitialMethod('PIX');
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
          <div>
            <label className="text-xs font-semibold mb-1 block">Consignatário (cliente) *</label>
            <div className="flex gap-2">
              <Select value={selectedCustomerId} onValueChange={id => {
                setSelectedCustomerId(id);
                const c = customers.find(x => x.id === id);
                setConsigneeName(c?.name || '');
              }}>
                <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Selecionar cliente existente" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={() => setShowNewCust(s => !s)}>
                <UserPlus className="w-4 h-4" /> Novo
              </Button>
            </div>
            {showNewCust && (
              <div className="mt-2 flex gap-2 bg-muted/40 rounded-lg p-2">
                <Input placeholder="Nome do cliente *" value={newCustName} onChange={e => setNewCustName(e.target.value)} className="h-9" />
                <Input placeholder="Telefone" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className="h-9 w-40" />
                <Button type="button" size="sm" onClick={addCustomer} disabled={addingCust}>{addingCust ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}</Button>
              </div>
            )}
            {consigneeName && <p className="text-xs text-muted-foreground mt-1">Selecionado: <span className="font-medium text-foreground">{consigneeName}</span></p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">Prazo de devolução *</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Tabela de preço</label>
              <Select value={priceTable} onValueChange={setPriceTable}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tables.map(t => <SelectItem key={t.key} value={t.key}>{t.name} · {t.payment_method}</SelectItem>)}
                </SelectContent>
              </Select>
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
                const unit = effectivePrice(p, priceTable, tables);
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">R$ {unit.toFixed(2).replace('.', ',')}</p>
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
                  <span className="font-medium tabular-nums">R$ {it.total.toFixed(2).replace('.', ',')}</span>
                  <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 bg-muted/40 font-semibold text-sm">
                <span>Total enviado</span><span className="tabular-nums">R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          )}

          <div className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Pagamento inicial (opcional)</p>
            <div className="flex gap-2">
              <Input type="number" min="0" placeholder="Valor pago agora (ex: 1000)" value={initialPayment || ''} onChange={e => setInitialPayment(Number(e.target.value) || 0)} className="h-9" />
              <Select value={initialMethod} onValueChange={setInitialMethod}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Dinheiro', 'PIX', 'Cartão'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Deixe 0 para registrar apenas a saída e cobrar depois em parcelas. O restante é pago em "Pagamento" na lista de consignações.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar consignação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}