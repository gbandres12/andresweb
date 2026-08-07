import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp, Wallet, ArrowRightLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BRL = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const REASONS = [
  { value: 'defeito', label: 'Defeito' }, { value: 'tamanho', label: 'Tamanho' },
  { value: 'cor', label: 'Cor' }, { value: 'modelo', label: 'Modelo' },
  { value: 'arrependimento', label: 'Arrependimento' }, { value: 'outros', label: 'Outros' },
];
const PAY = ['Dinheiro', 'PIX', 'Cartão'];

export default function ExchangeDialog({ open, onOpenChange, onCompleted }) {
  const [sales, setSales] = useState([]);
  const [saleSearch, setSaleSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [returnedQty, setReturnedQty] = useState({});
  const [mode, setMode] = useState('credito');
  const [products, setProducts] = useState([]);
  const [prodSearch, setProdSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [qty, setQty] = useState({});
  const [newItems, setNewItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [custSearch, setCustSearch] = useState('');
  const [creditCustomer, setCreditCustomer] = useState(null);
  const [reason, setReason] = useState('tamanho');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [refundMethod, setRefundMethod] = useState('Dinheiro');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      base44.entities.Sale.list('-created_date', 100).then(setSales);
      base44.entities.Product.list().then(setProducts);
      base44.entities.Customer.list().then(setCustomers);
      reset();
    }
  }, [open]);

  const reset = () => {
    setSelected(null); setReturnedQty({}); setNewItems([]); setMode('credito');
    setCreditCustomer(null); setSaleSearch(''); setProdSearch(''); setCustSearch(''); setNotes('');
    setExpanded({}); setQty({});
  };

  const matchedSales = sales.filter(s => {
    if (!saleSearch) return true;
    const q = saleSearch.toLowerCase();
    return (s.sale_number || '').toLowerCase().includes(q) || (s.customer_name || '').toLowerCase().includes(q);
  });

  const selectSale = (s) => {
    setSelected(s);
    const init = {};
    (s.items || []).forEach(i => { init[`${i.product_id}|${i.variant_size}|${i.variant_color}`] = 0; });
    setReturnedQty(init);
    setCreditCustomer(s.customer_id ? { id: s.customer_id, name: s.customer_name } : null);
  };

  const setRetQty = (it, val) => {
    const max = it.quantity || 0;
    setReturnedQty(r => ({ ...r, [`${it.product_id}|${it.variant_size}|${it.variant_color}`]: Math.min(max, Math.max(0, Number(val) || 0)) }));
  };

  const addVariant = (p, v) => {
    const k = `${p.id}-${v.size}-${v.color}`;
    const q = Number(qty[k] || 0);
    if (!q) { toast.error('Informe a quantidade'); return; }
    if (q > (v.stock || 0)) { toast.error(`Estoque disponível: ${v.stock || 0}`); return; }
    setNewItems(prev => {
      const ex = prev.find(i => i.product_id === p.id && i.variant_size === v.size && i.variant_color === v.color);
      if (ex) return prev.map(i => i === ex ? { ...i, quantity: i.quantity + q } : i);
      return [...prev, { product_id: p.id, product_name: p.name, variant_size: v.size, variant_color: v.color, quantity: q, unit_price: p.price }];
    });
    setQty(q2 => ({ ...q2, [k]: 0 }));
  };
  const removeNew = (idx) => setNewItems(prev => prev.filter((_, i) => i !== idx));

  const returnedItems = (selected?.items || []).map(i => ({
    ...i, qty: returnedQty[`${i.product_id}|${i.variant_size}|${i.variant_color}`] || 0,
  })).filter(i => i.qty > 0);

  const returned_value = returnedItems.reduce((s, i) => s + (i.unit_price || 0) * i.qty, 0);
  const new_value = newItems.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0);
  const difference = mode === 'credito' ? -returned_value : +(new_value - returned_value).toFixed(2);

  const filteredProds = products.filter(p =>
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.sku?.toLowerCase().includes(prodSearch.toLowerCase()) || p.gtin?.includes(prodSearch)
  );
  const matchedCusts = customers.filter(c => !custSearch || (c.name || '').toLowerCase().includes(custSearch.toLowerCase()));

  const confirm = async () => {
    if (!returnedItems.length) { toast.error('Selecione ao menos uma peça devolvida'); return; }
    if (mode === 'troca' && !newItems.length) { toast.error('Adicione ao menos uma nova peça'); return; }
    let customerId = selected.customer_id, customerName = selected.customer_name;
    if (mode === 'credito') {
      if (!creditCustomer?.id) { toast.error('Selecione um cliente para creditar o saldo'); return; }
      customerId = creditCustomer.id; customerName = creditCustomer.name;
    }
    setSaving(true);
    try {
      const payload = {
        mode,
        original_sale_id: selected.id,
        original_sale_number: selected.sale_number,
        customer_id: customerId, customer_name: customerName,
        returned_items: returnedItems.map(i => ({ product_id: i.product_id, product_name: i.product_name, variant_size: i.variant_size, variant_color: i.variant_color, quantity: i.qty, unit_price: i.unit_price })),
        new_items: mode === 'troca' ? newItems.map(i => ({ product_id: i.product_id, product_name: i.product_name, variant_size: i.variant_size, variant_color: i.variant_color, quantity: i.quantity, unit_price: i.unit_price })) : [],
        reason, payment_method: paymentMethod, refund_method: refundMethod, notes,
      };
      const res = await base44.functions.invoke('processExchange', payload);
      const d = res?.data?.difference ?? difference;
      const msg = mode === 'credito'
        ? `Crédito de ${BRL(returned_value)} gerado para ${customerName}`
        : d > 0 ? `Troca concluída — cliente pagou ${BRL(d)}` : d < 0 ? `Troca concluída — devolver ${BRL(Math.abs(d))}` : 'Troca concluída — equilibrado';
      toast.success(msg);
      onOpenChange?.(false);
      onCompleted?.();
    } catch (e) {
      toast.error('Erro: ' + (e?.response?.data?.error || e?.message || ''));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><RefreshCw className="w-5 h-5 text-primary" /> Troca / Devolução</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nº da venda ou cliente..." value={saleSearch} onChange={e => setSaleSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border border border-border rounded-xl">
              {matchedSales.map(s => (
                <button key={s.id} onClick={() => selectSale(s)} className="w-full text-left px-3 py-2.5 hover:bg-muted/50">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium font-mono">{s.sale_number || '—'}</span>
                    <span className="text-sm text-primary font-semibold">{BRL(s.total)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{s.customer_name || 'Consumidor'} · {new Date(s.created_date).toLocaleDateString('pt-BR')}</span>
                </button>
              ))}
              {matchedSales.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma venda</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Venda selecionada + devoluções */}
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-mono text-sm font-medium">{selected.sale_number}</p>
                  <p className="text-xs text-muted-foreground">{selected.customer_name || 'Consumidor'} · {BRL(selected.total)}</p>
                </div>
                <button onClick={() => { setSelected(null); setReturnedQty({}); }} className="text-xs text-muted-foreground hover:text-foreground underline">Trocar venda</button>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Peças devolvidas</p>
              <div className="space-y-1.5">
                {(selected.items || []).map((it, i) => {
                  const k = `${it.product_id}|${it.variant_size}|${it.variant_color}`;
                  return (
                    <div key={i} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{it.product_name}</p>
                        <p className="text-xs text-muted-foreground">{it.variant_size || '-'} · {it.variant_color || '-'} · {BRL(it.unit_price)} · máx {it.quantity}</p>
                      </div>
                      <Input type="number" min="0" max={it.quantity} value={returnedQty[k] ?? 0} onChange={e => setRetQty(it, e.target.value)} className="w-16 text-center" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modo */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('credito')} className={cn("flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-left", mode === 'credito' ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
                <Wallet className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Gerar crédito</p>
                  <p className="text-xs text-muted-foreground">Saldo para o cliente</p>
                </div>
              </button>
              <button onClick={() => setMode('troca')} className={cn("flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-left", mode === 'troca' ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Trocar por peças</p>
                  <p className="text-xs text-muted-foreground">Nova venda com diferença</p>
                </div>
              </button>
            </div>

            {/* Modo crédito: cliente */}
            {mode === 'credito' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">Cliente para creditar</Label>
                {creditCustomer ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{creditCustomer.name}</p>
                      <p className="text-xs text-muted-foreground">Saldo atual: {BRL(customers.find(c => c.id === creditCustomer.id)?.credit_balance || 0)} → após: {BRL((customers.find(c => c.id === creditCustomer.id)?.credit_balance || 0) + returned_value)}</p>
                    </div>
                    {!selected.customer_id && <button onClick={() => setCreditCustomer(null)} className="text-xs text-muted-foreground hover:text-foreground underline">Trocar</button>}
                  </div>
                ) : (
                  <div>
                    <Input placeholder="Buscar cliente..." value={custSearch} onChange={e => setCustSearch(e.target.value)} className="mb-2" />
                    <div className="max-h-40 overflow-y-auto divide-y divide-border border border-border rounded-lg">
                      {matchedCusts.map(c => (
                        <button key={c.id} onClick={() => setCreditCustomer({ id: c.id, name: c.name })} className="w-full text-left px-3 py-2 hover:bg-muted/50">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">Saldo: {BRL(c.credit_balance || 0)}</p>
                        </button>
                      ))}
                      {matchedCusts.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum cliente</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modo troca: novas peças */}
            {mode === 'troca' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide">Novas peças</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar produto..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="border border-border rounded-xl max-h-44 overflow-y-auto">
                  {filteredProds.map(p => {
                    const isOpen = expanded[p.id];
                    return (
                      <div key={p.id} className="border-b border-border last:border-0">
                        <button type="button" onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))} className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 text-left">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.sku || p.category} · {BRL(p.price)}</p>
                          </div>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 space-y-1.5 bg-muted/20">
                            {(p.variants || []).map((v, i) => {
                              const k = `${p.id}-${v.size}-${v.color}`;
                              return (
                                <div key={i} className="flex items-center gap-2 bg-card rounded-lg px-2.5 py-1.5 border border-border">
                                  <span className="text-xs flex-1">{v.size || '-'} · {v.color || '-'} · <span className={cn("font-medium", (v.stock || 0) <= 3 ? "text-amber-600" : "text-muted-foreground")}>{v.stock || 0} un</span></span>
                                  <Input type="number" min="0" value={qty[k] || ''} onChange={e => setQty(q => ({ ...q, [k]: Math.max(0, Number(e.target.value) || 0) }))} className="w-16 h-8 text-center text-sm" placeholder="0" />
                                  <Button size="sm" variant="outline" type="button" onClick={() => addVariant(p, v)} className="h-8 px-2"><Plus className="w-3.5 h-3.5" /></Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredProds.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto</p>}
                </div>
                {newItems.length > 0 && (
                  <div className="space-y-1.5">
                    {newItems.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 border border-border rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{it.product_name}</p>
                          <p className="text-xs text-muted-foreground">{it.variant_size || '-'} · {it.variant_color || '-'} · {BRL(it.unit_price)}</p>
                        </div>
                        <span className="text-sm font-semibold">{it.quantity}x</span>
                        <button type="button" onClick={() => removeNew(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resumo */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Devolvido</span><span className="font-medium">{BRL(returned_value)}</span></div>
              {mode === 'troca' && <div className="flex justify-between"><span className="text-muted-foreground">Novas peças</span><span className="font-medium">{BRL(new_value)}</span></div>}
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="font-medium">{mode === 'credito' ? 'Crédito a gerar' : 'Diferença'}</span>
                <span className={cn("text-lg font-bold", difference > 0 ? "text-amber-600" : difference < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                  {mode === 'credito' ? BRL(returned_value) : difference > 0 ? `Pagar ${BRL(difference)}` : difference < 0 ? `Devolver ${BRL(Math.abs(difference))}` : 'Equilibrado'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Motivo</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {mode === 'troca' && difference > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Cliente paga via</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAY.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {((mode === 'troca' && difference < 0) || mode === 'credito') && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide">{mode === 'credito' ? 'Crédito via' : 'Loja devolve via'}</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAY.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button onClick={confirm} disabled={saving || !returnedItems.length || (mode === 'troca' && !newItems.length) || (mode === 'credito' && !creditCustomer?.id)} className="w-full h-11 text-base">
              <RefreshCw className="w-4 h-4 mr-2" /> {saving ? 'Processando...' : mode === 'credito' ? 'Gerar crédito' : 'Confirmar troca'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}