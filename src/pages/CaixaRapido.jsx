import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Plus, Minus, Trash2, Check, Loader2, AlertTriangle, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { effectivePrice, getStoreTables, getStorePaymentMethods, getPaymentMethodLabel } from '@/lib/priceTables';
import { useStore } from '@/lib/StoreContext';
import { useNavigate } from 'react-router-dom';

const SALES_CHANNELS = ['Loja Física', 'WhatsApp', 'Instagram', 'Facebook', 'Site / E-commerce', 'Telefone', 'Indicação', 'Feira / Evento', 'Outros'];

export default function CaixaRapido() {
  const { store } = useStore();
  const tables = getStoreTables(store);
  const paymentMethods = getStorePaymentMethods(store);
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Entrada: Quantidade -> Referência -> Tabela
  const [qty, setQty] = useState(1);
  const [ref, setRef] = useState('');
  const [table, setTable] = useState(tables[0]?.key || 'cliente_final');
  const [preview, setPreview] = useState(null); // produto resolvido

  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [seller, setSeller] = useState('');
  const [consultant, setConsultant] = useState('');
  const [salesChannel, setSalesChannel] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSale, setLastSale] = useState({ num: '', total: 0, troco: 0, cashReceived: 0, paymentMethod: '' });
  const [inadimplencia, setInadimplencia] = useState(null);
  const [sellers, setSellers] = useState([]);

  const qtyRef = useRef(null);
  const refRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => setSeller(u?.full_name || '')).catch(() => {});
    base44.entities.Employee.filter({}, 'name', 500)
      .then(list => setSellers((list || []).filter(e => e.active !== false)))
      .catch(() => {});
    base44.entities.Product.filter({ is_active: true }, '-created_date', 5000)
      .then(list => { setProducts(list || []); setLoadingProducts(false); })
      .catch(() => setLoadingProducts(false));
  }, []);

  // ESC sai do Caixa Rápido (ignora se houver select/dialog aberto). ENTER salva referências — fluxo já existente.
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (loading) return;
      if (document.querySelector('[data-state="open"][role="listbox"], [data-state="open"][role="dialog"], [data-state="open"][role="menu"]')) return;
      e.preventDefault();
      navigate('/');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, loading]);

  const sellerOptions = [...sellers.map(s => s.name), ...(seller && !sellers.some(s => s.name === seller) ? [seller] : [])];
  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const total = Math.max(0, subtotal - (discount || 0));
  const cashReceivedNum = Number(cashReceived) || 0;
  const troco = paymentMethod === 'Dinheiro' && cashReceivedNum > 0 ? Math.max(0, cashReceivedNum - total) : 0;

  const resolveProduct = (term) => {
    const t = (term || '').trim().toLowerCase();
    if (!t) return null;
    return (
      products.find(p => (p.reference || '').toLowerCase() === t) ||
      products.find(p => (p.gtin || '').toLowerCase() === t) ||
      products.find(p => (p.sku || '').toLowerCase() === t) ||
      products.find(p => (p.name || '').toLowerCase().includes(t))
    ) || null;
  };

  const onRefChange = (v) => {
    setRef(v);
    const p = resolveProduct(v);
    setPreview(p || null);
  };

  const addEntry = () => {
    const product = preview || resolveProduct(ref);
    if (!product) { toast.error('Referência não encontrada'); return; }
    const variant = product.variants?.find(v => (v.stock || 0) > 0) || product.variants?.[0];
    if (!variant) { toast.error('Produto sem variantes'); return; }
    if ((variant.stock || 0) <= 0) { toast.error('Sem estoque'); return; }
    const q = Math.max(1, Number(qty) || 1);
    if (q > (variant.stock || 0)) { toast.error(`Estoque insuficiente (${variant.stock} un)`); return; }
    const unit = effectivePrice(product, table, tables);
    const key = `${product.id}-${variant.size}-${variant.color}`;
    const existing = cart.find(i => i.key === key);
    if (existing) {
      if (existing.quantity + q > (variant.stock || 0)) { toast.error('Estoque insuficiente'); return; }
      setCart(cart.map(i => i.key === key ? { ...i, quantity: i.quantity + q, total: (i.quantity + q) * i.unit_price } : i));
    } else {
      setCart([...cart, {
        key, product_id: product.id, product_name: product.name,
        variant_size: variant.size, variant_color: variant.color,
        quantity: q, unit_price: unit, total: unit * q,
      }]);
    }
    setRef(''); setPreview(null); setQty(1);
    setTimeout(() => refRef.current?.focus(), 0);
  };

  const onRefKey = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (preview) addEntry();
    else if (ref.trim()) toast.error('Referência não encontrada');
  };

  const updateQty = (key, delta) => {
    setCart(cart.map(i => {
      if (i.key !== key) return i;
      const n = i.quantity + delta;
      if (n <= 0) return null;
      return { ...i, quantity: n, total: n * i.unit_price };
    }).filter(Boolean));
  };

  const changeVariant = (key, field, val) => {
    setCart(cart.map(i => {
      if (i.key !== key) return i;
      const product = products.find(p => p.id === i.product_id);
      const size = field === 'size' ? val : i.variant_size;
      const color = field === 'color' ? val : i.variant_color;
      const v = product?.variants?.find(v => v.size === size && v.color === color);
      return { ...i, variant_size: size, variant_color: color, key: `${i.product_id}-${size}-${color}` };
    }));
  };

  const removeFromCart = (key) => setCart(cart.filter(i => i.key !== key));

  const genFaturaNumber = async () => {
    try {
      const filter = store?.id ? { sale_type: 'consignacao', store_id: store.id } : { sale_type: 'consignacao' };
      const list = await base44.entities.Sale.filter(filter, '-created_date', 200);
      const year = new Date().getFullYear();
      let max = 0;
      (list || []).forEach(s => {
        const m = String(s.sale_number || '').match(/FAT-(\d{4})-(\d+)/);
        if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
      });
      return `FAT-${year}-${String(max + 1).padStart(4, '0')}`;
    } catch {
      return `FAT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    }
  };

  const finalizeSale = async () => {
    if (!cart.length) { toast.error('Carrinho vazio'); return; }
    if (!paymentMethod) { toast.error('Selecione o pagamento'); return; }
    if (!salesChannel) { toast.error('Selecione o canal de venda'); return; }
    if (!seller.trim()) { toast.error('Informe o vendedor'); return; }
    if (paymentMethod === 'Consignação' && !customerName.trim()) { toast.error('Informe o nome do cliente (consignatário) para gerar a fatura'); return; }

    if (paymentMethod === 'Crédito da loja') {
      if (!customerName.trim()) { toast.error('Informe o cliente para usar crédito da loja'); return; }
      try {
        const custs = await base44.entities.Customer.filter({ name: customerName.trim() }, '-created_date', 5);
        const cust = custs.find(c => c.name?.toLowerCase() === customerName.trim().toLowerCase());
        if (!cust) { toast.error('Cliente não cadastrado'); return; }
        if ((cust.credit_balance || 0) < total) {
          toast.error(`Saldo insuficiente: R$ ${(cust.credit_balance || 0).toFixed(2).replace('.', ',')}`);
          return;
        }
        return doFinalize(cust.id);
      } catch { toast.error('Erro ao validar crédito'); return; }
    }

    if (customerName.trim()) {
      try {
        const custs = await base44.entities.Customer.filter({ name: customerName.trim() }, '-created_date', 5);
        const cust = custs.find(c => c.name?.toLowerCase() === customerName.trim().toLowerCase());
        if (cust) {
          const today = format(new Date(), 'yyyy-MM-dd');
          const txns = await base44.entities.Transaction.filter(
            { customer_id: cust.id, type: 'receita', status: 'pendente' }, '-due_date', 200
          );
          const overdue = txns.filter(t => t.due_date && t.due_date < today);
          if (overdue.length) {
            setInadimplencia({
              amount: overdue.reduce((s, t) => s + (t.amount || 0), 0),
              count: overdue.length,
              customerId: cust.id,
              blocked: !!store?.settings?.bloquear_inadimplente,
            });
            return;
          }
        }
      } catch { /* ignore */ }
    }
    doFinalize();
  };

  const doFinalize = async (customerId = null) => {
    setLoading(true);
    const isConsignacao = paymentMethod === 'Consignação';
    const saleNum = isConsignacao ? await genFaturaNumber() : `VND-${Date.now().toString().slice(-6)}`;
    await base44.entities.Sale.create({
      store_id: store?.id,
      sale_number: saleNum,
      items: cart.map(({ key, ...i }) => i),
      subtotal, discount: discount || 0, total,
      price_table: table,
      payment_method: paymentMethod,
      payment_details: isConsignacao
        ? 'Fatura de consignação — recebimentos abatem o saldo'
        : (paymentMethod === 'Dinheiro' && cashReceivedNum > 0
          ? `Recebido: R$ ${cashReceivedNum.toFixed(2)} | Troco: R$ ${troco.toFixed(2)}` : ''),
      customer_id: customerId, customer_name: customerName, customer_phone: customerPhone,
      seller_name: seller, consultant_name: consultant, sales_channel: salesChannel,
      status: isConsignacao ? 'pendente' : 'concluida',
      sale_type: isConsignacao ? 'consignacao' : 'venda',
      ...(isConsignacao ? {
        consignee_name: customerName,
        consignment_status: 'em_consignacao',
        consignment_paid: 0,
        consignment_payments: [],
      } : {}),
    });

    try {
      const cfg = store?.settings?.commission || {};
      const rate = Number(cfg.sellers?.[seller] ?? cfg.default_rate ?? 0);
      if (rate > 0 && seller) {
        await base44.entities.Commission.create({
          sale_number: saleNum, seller_name: seller,
          base_type: cfg.base || 'faturamento', base_amount: total, rate,
          amount: (total * rate) / 100, status: 'pendente',
        });
      }
    } catch { /* ignore */ }

    for (const item of cart) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) continue;
      const updatedVariants = product.variants?.map(v =>
        (v.size === item.variant_size && v.color === item.variant_color)
          ? { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) } : v
      );
      await base44.entities.Product.update(product.id, { variants: updatedVariants });
    }

    if (paymentMethod === 'Crédito da loja' && customerId) {
      try {
        const cust = await base44.entities.Customer.get(customerId);
        await base44.entities.Customer.update(customerId, {
          credit_balance: Math.max(0, (cust.credit_balance || 0) - total),
        });
      } catch { /* ignore */ }
    }

    // Atualiza estoque local
    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.product_id === p.id);
      if (!ci) return p;
      return { ...p, variants: p.variants?.map(v =>
        (v.size === ci.variant_size && v.color === ci.variant_color)
          ? { ...v, stock: Math.max(0, (v.stock || 0) - ci.quantity) } : v) };
    }));

    setLastSale({ num: saleNum, total, troco, cashReceived: cashReceivedNum, paymentMethod, isConsignacao: paymentMethod === 'Consignação' });
    setCart([]); setDiscount(0); setPaymentMethod(''); setCashReceived('');
    setCustomerName(''); setCustomerPhone(''); setConsultant(''); setSalesChannel('');
    setShowSuccess(true); setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-40 bg-muted overflow-y-auto py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-center flex-1">
            <h1 className="font-serif text-3xl font-semibold text-foreground">Caixa Rápido</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {store?.name} · digite a quantidade, a referência e a tabela
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
            title="Sair (ESC)"
          >
            <span className="hidden sm:inline">ESC para sair</span>
            <span className="sm:hidden">ESC</span>
          </button>
        </div>

        {/* Entrada de produto — foco central */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="bg-primary text-primary-foreground px-5 py-2.5">
            <p className="font-serif font-semibold tracking-wide">DADOS DO PRODUTO</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">1. Quantidade</label>
                <Input
                  ref={qtyRef}
                  type="number"
                  min="1"
                  value={qty}
                  onChange={e => setQty(Number(e.target.value) || 1)}
                  onKeyDown={e => { if (e.key === 'Enter') refRef.current?.focus(); }}
                  className="h-12 text-lg text-center font-semibold"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">2. Referência / Código</label>
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                  <Input
                    ref={refRef}
                    autoFocus
                    value={ref}
                    onChange={e => onRefChange(e.target.value)}
                    onKeyDown={onRefKey}
                    placeholder="Referência Fernanda, GTIN, SKU ou nome"
                    className="pl-10 h-12 text-lg"
                  />
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">3. Tabela</label>
                <Select value={table} onValueChange={setTable}>
                  <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tables.map(t => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-1">
                <Button onClick={addEntry} className="w-full h-12 text-base">+</Button>
              </div>
            </div>

            {/* Preview do produto resolvido */}
            {preview && (
              <div className="mt-3 flex items-center justify-between bg-muted/60 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{preview.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {preview.category} · Ref. {preview.reference || '—'} ·{' '}
                    {preview.variants?.find(v => (v.stock || 0) > 0)
                      ? `${preview.variants.find(v => (v.stock || 0) > 0).size || '-'} / ${preview.variants.find(v => (v.stock || 0) > 0).color || '-'}`
                      : 'sem estoque'}
                  </p>
                </div>
                <p className="text-lg font-serif font-semibold text-primary">
                  R$ {effectivePrice(preview, table, tables).toFixed(2).replace('.', ',')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Carrinho */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="bg-secondary text-secondary-foreground px-5 py-2.5 flex items-center gap-2">
            <p className="font-serif font-semibold tracking-wide">CARRINHO</p>
            <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2.5 py-0.5 font-sans font-semibold">{cart.length}</span>
          </div>
          <div className="p-3 space-y-2">
            {cart.map(item => {
              const product = products.find(p => p.id === item.product_id);
              const sizes = [...new Set(product?.variants?.map(v => v.size) || [])];
              const colors = [...new Set(product?.variants?.map(v => v.color) || [])];
              return (
                <div key={item.key} className="bg-background rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                      <div className="flex gap-1.5 mt-1">
                        {sizes.length > 1 && (
                          <select value={item.variant_size} onChange={e => changeVariant(item.key, 'size', e.target.value)}
                            className="text-xs border border-border rounded px-1.5 py-0.5 bg-background">
                            {sizes.map(s => <option key={s} value={s}>{s || '-'}</option>)}
                          </select>
                        )}
                        {colors.length > 1 && (
                          <select value={item.variant_color} onChange={e => changeVariant(item.key, 'color', e.target.value)}
                            className="text-xs border border-border rounded px-1.5 py-0.5 bg-background">
                            {colors.map(c => <option key={c} value={c}>{c || '-'}</option>)}
                          </select>
                        )}
                        <span className="text-xs text-muted-foreground self-center">
                          R$ {item.unit_price.toFixed(2).replace('.', ',')} / un
                        </span>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.key)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.key, -1)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-semibold w-7 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.key, 1)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-primary">R$ {item.total.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              );
            })}
            {cart.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                {loadingProducts ? 'Carregando produtos...' : 'Carrinho vazio — digite a referência acima'}
              </div>
            )}
          </div>
        </div>

        {/* Fechamento */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="bg-primary text-primary-foreground px-5 py-2.5">
            <p className="font-serif font-semibold tracking-wide">FECHAMENTO</p>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Canal de venda *</label>
              <Select value={salesChannel} onValueChange={setSalesChannel}>
                <SelectTrigger className="h-11"><SelectValue placeholder="De onde veio a venda?" /></SelectTrigger>
                <SelectContent>{SALES_CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Vendedor *</label>
              <Select value={seller} onValueChange={setSeller}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>
                  {sellerOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Nome do cliente (opcional)" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-11" />
            <Input placeholder="Telefone (opcional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-11" />
            <Input placeholder="Consultor (opcional)" value={consultant} onChange={e => setConsultant(e.target.value)} className="h-11" />
            <Input type="number" placeholder="Desconto (R$)" value={discount || ''} onChange={e => setDiscount(Number(e.target.value))} className="h-11" />
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Forma de pagamento *</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {paymentMethod === 'Dinheiro' && (
              <div className="sm:col-span-2 space-y-2">
                <Input type="number" placeholder="Valor recebido (R$)" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="h-11" />
                {cashReceivedNum > 0 && (
                  <div className={cn("flex justify-between text-sm rounded-lg px-3 py-2",
                    cashReceivedNum >= total ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                    <span>{cashReceivedNum >= total ? 'Troco' : 'Recebido insuficiente'}</span>
                    <span className="font-semibold tabular-nums">R$ {Math.abs(cashReceivedNum - total).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="sm:col-span-2 bg-muted rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span><span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-700">
                  <span>Desconto</span><span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-serif font-semibold text-foreground border-t border-border pt-2 mt-1">
                <span>Total</span><span>R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            <Button onClick={finalizeSale} disabled={loading || !cart.length} className="sm:col-span-2 h-12 text-base">
              {loading ? 'Finalizando...' : 'Concluir Venda'}
            </Button>
          </div>
        </div>
      </div>

      {/* Sucesso */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold">{lastSale.isConsignacao ? 'Fatura Gerada!' : 'Venda Realizada!'}</h2>
              <p className="text-muted-foreground text-sm mt-1">#{lastSale.num}</p>
              {lastSale.isConsignacao && (
                <p className="text-xs text-primary mt-1">Consignação em aberto — registre os recebimentos em Consignações.</p>
              )}
              <p className="text-xl font-serif font-semibold text-primary mt-2">R$ {lastSale.total.toFixed(2).replace('.', ',')}</p>
              {lastSale.paymentMethod === 'Dinheiro' && lastSale.cashReceived > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Recebido: R$ {lastSale.cashReceived.toFixed(2).replace('.', ',')} · Troco:{' '}
                  <strong className="text-emerald-700">R$ {lastSale.troco.toFixed(2).replace('.', ',')}</strong>
                </p>
              )}
            </div>
            <Button onClick={() => { setShowSuccess(false); refRef.current?.focus(); }} className="w-full h-11">Nova Venda</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inadimplência */}
      <Dialog open={!!inadimplencia} onOpenChange={v => { if (!v) setInadimplencia(null); }}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold">Cliente Inadimplente</h2>
              <p className="text-muted-foreground text-sm mt-1">
                <strong className="text-destructive">{inadimplencia?.count} título(s)</strong> vencido(s) somando{' '}
                <strong className="text-destructive">R$ {(inadimplencia?.amount || 0).toFixed(2).replace('.', ',')}</strong>.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setInadimplencia(null)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" disabled={inadimplencia?.blocked}
                onClick={() => { const c = inadimplencia; setInadimplencia(null); doFinalize(c?.customerId || null); }} className="flex-1">
                {inadimplencia?.blocked ? 'Venda Bloqueada' : 'Continuar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}