import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Plus, Minus, Trash2, ShoppingCart, Check, Loader2, ScanLine, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePaginatedProducts } from '@/hooks/usePaginatedProducts';
import { effectivePrice, PRICE_TABLES } from '@/lib/priceTables';
import { useStore } from '@/lib/StoreContext';
import ExchangeDialog from '@/components/exchange/ExchangeDialog';

const PAGE_SIZE = 40;
const SALES_CHANNELS = ['Loja Física', 'WhatsApp', 'Instagram', 'Facebook', 'Site / E-commerce', 'Telefone', 'Indicação', 'Feira / Evento', 'Outros'];

export default function PDV() {
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleNum, setLastSaleNum] = useState('');
  const [lastSaleInfo, setLastSaleInfo] = useState({ total: 0, troco: 0, cashReceived: 0, paymentMethod: '' });
  const [loading, setLoading] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [priceTable, setPriceTable] = useState('cliente_final');
  const [scan, setScan] = useState('');
  const [seller, setSeller] = useState('');
  const [consultant, setConsultant] = useState('');
  const [salesChannel, setSalesChannel] = useState('');
  const [inadimplencia, setInadimplencia] = useState(null);
  const [cashReceived, setCashReceived] = useState('');
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const gridRef = useRef(null);
  const { store } = useStore();

  useEffect(() => {
    base44.auth.me().then(u => setSeller(u?.full_name || '')).catch(() => {});
  }, []);

  const {
    items: products, setItems, loading: loadingProducts, loadingMore, hasMore,
    search, setSearch, sentinelRef, reload: reloadProducts,
  } = usePaginatedProducts({ activeOnly: true, pageSize: PAGE_SIZE, scrollRootRef: gridRef });

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal - (discount || 0));
  const cashReceivedNum = Number(cashReceived) || 0;
  const troco = paymentMethod === 'Dinheiro' && cashReceivedNum > 0 ? Math.max(0, cashReceivedNum - total) : 0;

  const getProductStock = (product, size, color) => {
    const v = product.variants?.find(v => v.size === size && v.color === color);
    return v?.stock || 0;
  };

  const addToCart = (product, variant) => {
    const key = `${product.id}-${variant.size}-${variant.color}`;
    const existing = cart.find(i => i.key === key);
    const stock = getProductStock(product, variant.size, variant.color);
    const unit = effectivePrice(product, priceTable);

    if (existing) {
      if (existing.quantity >= stock) {
        toast.error('Estoque insuficiente');
        return;
      }
      setCart(cart.map(i => i.key === key ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i));
    } else {
      if (stock <= 0) {
        toast.error('Sem estoque disponível');
        return;
      }
      setCart([...cart, {
        key,
        product_id: product.id,
        product_name: product.name,
        variant_size: variant.size,
        variant_color: variant.color,
        quantity: 1,
        unit_price: unit,
        total: unit,
      }]);
    }
  };

  // Leitor de código de barras USB: o scanner digita o GTIN/EAN e envia Enter
  const handleScan = async (e) => {
    if (e.key !== 'Enter') return;
    const code = scan.trim();
    if (!code) return;
    setScan('');
    let product = products.find(p => p.gtin === code);
    if (!product) {
      try {
        const found = await base44.entities.Product.filter({ gtin: code }, '-created_date', 1);
        product = found[0];
      } catch { /* ignore */ }
    }
    if (!product) { toast.error('Código não encontrado'); return; }
    if (!product.is_active) { toast.error('Produto inativo'); return; }
    const variant = product.variants?.find(v => (v.stock || 0) > 0) || product.variants?.[0];
    if (!variant) { toast.error('Produto sem variantes'); return; }
    addToCart(product, variant);
  };

  const updateQty = (key, delta) => {
    setCart(cart.map(i => {
      if (i.key !== key) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return null;
      return { ...i, quantity: newQty, total: newQty * i.unit_price };
    }).filter(Boolean));
  };

  const removeFromCart = (key) => setCart(cart.filter(i => i.key !== key));

  const finalizeSale = async () => {
    if (!cart.length) { toast.error('Carrinho vazio'); return; }
    if (!paymentMethod) { toast.error('Selecione o pagamento'); return; }
    if (!salesChannel) { toast.error('Selecione o canal de venda'); return; }
    if (!seller.trim()) { toast.error('Informe o vendedor'); return; }

    // Crédito da loja: valida saldo do cliente antes de finalizar
    if (paymentMethod === 'Crédito da loja') {
      if (!customerName.trim()) { toast.error('Informe o cliente para usar crédito da loja'); return; }
      try {
        const custs = await base44.entities.Customer.filter({ name: customerName.trim() }, '-created_date', 5);
        const cust = custs.find(c => c.name?.toLowerCase() === customerName.trim().toLowerCase());
        if (!cust) { toast.error('Cliente não cadastrado'); return; }
        if ((cust.credit_balance || 0) < total) {
          toast.error(`Saldo de crédito insuficiente: R$ ${(cust.credit_balance || 0).toFixed(2).replace('.', ',')}`);
          return;
        }
        return doFinalize(cust.id);
      } catch { toast.error('Erro ao validar crédito da loja'); return; }
    }

    // Verifica inadimplência: títulos vencidos do cliente em Contas a Receber
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
            const totalOver = overdue.reduce((s, t) => s + (t.amount || 0), 0);
            setInadimplencia({
              amount: totalOver,
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

    const saleNum = `VND-${Date.now().toString().slice(-6)}`;
    const saleData = {
      sale_number: saleNum,
      items: cart.map(({ key, ...i }) => i),
      subtotal,
      discount: discount || 0,
      total,
      price_table: priceTable,
      payment_method: paymentMethod,
      payment_details: paymentMethod === 'Dinheiro' && cashReceivedNum > 0
        ? `Recebido: R$ ${cashReceivedNum.toFixed(2)} | Troco: R$ ${troco.toFixed(2)}`
        : '',
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      seller_name: seller,
      consultant_name: consultant,
      sales_channel: salesChannel,
      notes,
      status: 'concluida',
    };

    const created = await base44.entities.Sale.create(saleData);

    // Comissão automática por vendedor (base: faturamento ou liquidação)
    try {
      const cfg = store?.settings?.commission || {};
      const rate = Number(cfg.sellers?.[seller] ?? cfg.default_rate ?? 0);
      if (rate > 0 && seller) {
        await base44.entities.Commission.create({
          sale_id: created.id,
          sale_number: saleNum,
          seller_name: seller,
          base_type: cfg.base || 'faturamento',
          base_amount: total,
          rate,
          amount: (total * rate) / 100,
          status: 'pendente',
        });
      }
    } catch { /* ignore */ }

    // Atualiza estoque no servidor e, em paralelo, otimista na lista paginada
    setItems(prev => prev.map(p => {
      const cartItem = cart.find(i => i.product_id === p.id);
      if (!cartItem) return p;
      return {
        ...p,
        variants: p.variants?.map(v =>
          (v.size === cartItem.variant_size && v.color === cartItem.variant_color)
            ? { ...v, stock: Math.max(0, (v.stock || 0) - cartItem.quantity) }
            : v
        ),
      };
    }));

    for (const item of cart) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) continue;
      const updatedVariants = product.variants?.map(v => {
        if (v.size === item.variant_size && v.color === item.variant_color) {
          return { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) };
        }
        return v;
      });
      await base44.entities.Product.update(product.id, { variants: updatedVariants });
    }

    // Débito do crédito da loja (saldo do cliente)
    if (paymentMethod === 'Crédito da loja' && customerId) {
      try {
        const cust = await base44.entities.Customer.get(customerId);
        await base44.entities.Customer.update(customerId, {
          credit_balance: Math.max(0, (cust.credit_balance || 0) - total),
        });
      } catch { /* ignore */ }
    }

    setLastSaleNum(saleNum);
    setLastSaleInfo({ total, troco, cashReceived: cashReceivedNum, paymentMethod });
    setCart([]);
    setDiscount(0);
    setPaymentMethod('');
    setCashReceived('');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setConsultant('');
    setSalesChannel('');
    setShowSuccess(true);
    setLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-0px)] lg:h-screen overflow-hidden bg-background">
      {/* Products panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
        <div className="p-5 border-b border-border bg-card">
          <h1 className="font-serif text-2xl font-semibold mb-3 text-foreground">PDV — Frente de Caixa</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto ou categoria (servidor)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          <div className="relative mt-3">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input
              placeholder="Leitor de código de barras (GTIN/EAN) — escaneie e dê Enter"
              value={scan}
              onChange={e => setScan(e.target.value)}
              onKeyDown={handleScan}
              className="pl-9 h-11 border-primary/40"
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground font-medium">Tabela:</span>
            <Select value={priceTable} onValueChange={setPriceTable}>
              <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRICE_TABLES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div ref={gridRef} className="flex-1 overflow-y-auto p-5">
          {loadingProducts ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={addToCart}
                    selectedVariants={selectedVariants}
                    setSelectedVariants={setSelectedVariants}
                    priceTable={priceTable}
                  />
                ))}
                {products.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-12 text-base">
                    Nenhum produto encontrado
                  </div>
                )}
              </div>

              {/* Sentinel + status infinite scroll */}
              <div ref={sentinelRef} className="h-px" />
              <div className="py-4 text-center text-xs text-muted-foreground">
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando mais...</span>
                ) : hasMore ? 'Role para carregar mais produtos' : products.length > 0 ? 'Fim do catálogo' : ''}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 xl:w-[26rem] flex flex-col bg-card">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold text-foreground">Carrinho</h2>
          <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2.5 py-1 font-sans font-semibold">
            {cart.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => setExchangeOpen(true)} className="h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Troca
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.map(item => (
            <div key={item.key} className="bg-background rounded-xl p-3 border border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{item.variant_size} · {item.variant_color}</p>
                </div>
                <button onClick={() => removeFromCart(item.key)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.key, -1)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-semibold w-7 text-center text-foreground">{item.quantity}</span>
                  <button onClick={() => updateQty(item.key, 1)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-sm font-semibold text-primary">R$ {item.total.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Adicione produtos ao carrinho
            </div>
          )}
        </div>

        {/* Summary & checkout */}
        <div className="p-5 border-t border-border space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Canal de venda *</label>
            <Select value={salesChannel} onValueChange={setSalesChannel}>
              <SelectTrigger className={cn("h-10", !salesChannel && "border-primary ring-1 ring-primary/30")}>
                <SelectValue placeholder="De onde veio esta venda?" />
              </SelectTrigger>
              <SelectContent>
                {SALES_CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Nome do consultor" value={consultant} onChange={e => setConsultant(e.target.value)} className="h-10" />
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Vendedor *</label>
            <Input placeholder="Nome do vendedor" value={seller} onChange={e => setSeller(e.target.value)} className={cn("h-10", !seller.trim() && "border-primary ring-1 ring-primary/30")} />
          </div>
          <Input placeholder="Nome do cliente" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-10" />
          <Input placeholder="Telefone (opcional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-10" />
          <Input
            type="number"
            placeholder="Desconto (R$)"
            value={discount || ''}
            onChange={e => setDiscount(Number(e.target.value))}
            className="h-10"
          />
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
            <SelectContent>
              {['Dinheiro', 'PIX', 'Cartão', 'Crédito da loja'].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {paymentMethod === 'Dinheiro' && (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Valor recebido em dinheiro (R$)"
                value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
                className="h-10"
              />
              {cashReceivedNum > 0 && (
                <div className={cn(
                  "flex justify-between text-sm rounded-lg px-3 py-2",
                  cashReceivedNum >= total
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                )}>
                  <span>{cashReceivedNum >= total ? 'Troco para o cliente' : 'Valor recebido insuficiente'}</span>
                  <span className="font-semibold tabular-nums">
                    R$ {Math.abs(cashReceivedNum - total).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="bg-muted rounded-xl p-4 space-y-1.5">
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

          <Button
            className="w-full h-11 text-base"
            onClick={finalizeSale}
            disabled={loading || !cart.length}
          >
            {loading ? 'Finalizando...' : 'Finalizar Venda'}
          </Button>
        </div>
      </div>

      {/* Success dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold text-foreground">Venda Realizada!</h2>
              <p className="text-muted-foreground text-sm mt-1">#{lastSaleNum}</p>
              <p className="text-xl font-serif font-semibold text-primary mt-2">R$ {lastSaleInfo.total.toFixed(2).replace('.', ',')}</p>
              {lastSaleInfo.paymentMethod === 'Dinheiro' && lastSaleInfo.cashReceived > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Recebido: R$ {lastSaleInfo.cashReceived.toFixed(2).replace('.', ',')} · Troco:{' '}
                  <strong className="text-emerald-700">R$ {lastSaleInfo.troco.toFixed(2).replace('.', ',')}</strong>
                </p>
              )}
            </div>
            <Button onClick={() => setShowSuccess(false)} className="w-full h-11">Nova Venda</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alerta de inadimplência */}
      <Dialog open={!!inadimplencia} onOpenChange={v => { if (!v) setInadimplencia(null); }}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">Cliente Inadimplente</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Este cliente possui <strong className="text-destructive">{inadimplencia?.count} título(s)</strong> vencido(s)
                somando <strong className="text-destructive">R$ {(inadimplencia?.amount || 0).toFixed(2).replace('.', ',')}</strong> em Contas a Receber.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setInadimplencia(null)} className="flex-1">Cancelar Venda</Button>
              <Button
                variant="destructive"
                disabled={inadimplencia?.blocked}
                onClick={() => { const c = inadimplencia; setInadimplencia(null); doFinalize(c?.customerId || null); }}
                className="flex-1"
              >
                {inadimplencia?.blocked ? 'Venda Bloqueada' : 'Continuar Mesmo Assim'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ExchangeDialog open={exchangeOpen} onOpenChange={setExchangeOpen} onCompleted={reloadProducts} />
    </div>
  );
}

function ProductCard({ product, onAdd, selectedVariants, setSelectedVariants, priceTable }) {
  const sizes = [...new Set(product.variants?.map(v => v.size) || [])];
  const colors = [...new Set(product.variants?.map(v => v.color) || [])];
  const key = product.id;
  const selSize = selectedVariants[key]?.size || sizes[0] || '';
  const selColor = selectedVariants[key]?.color || colors[0] || '';
  const variant = product.variants?.find(v => v.size === selSize && v.color === selColor);
  const stock = variant?.stock || 0;

  const setVariant = (field, val) => {
    setSelectedVariants(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  };

  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-3 flex flex-col gap-2 hover:border-primary/40 transition-all",
      stock === 0 && "opacity-60"
    )}>
      {product.images?.[0] ? (
        <img src={product.images[0]} alt={product.name} className="w-full aspect-square object-cover rounded-lg" />
      ) : (
        <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center">
          <span className="text-3xl">👗</span>
        </div>
      )}
      <div>
        <p className="text-sm font-medium truncate text-foreground">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.category}</p>
        <p className="text-base font-serif font-semibold text-primary mt-0.5">R$ {effectivePrice(product, priceTable).toFixed(2).replace('.', ',')}</p>
      </div>

      {sizes.length > 1 && (
        <select
          value={selSize}
          onChange={e => setVariant('size', e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
        >
          {sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {colors.length > 1 && (
        <select
          value={selColor}
          onChange={e => setVariant('color', e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
        >
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className={cn("text-xs", stock <= 3 ? "text-amber-600" : "text-muted-foreground")}>
          {stock === 0 ? 'Sem estoque' : `${stock} un`}
        </span>
        <button
          disabled={stock === 0}
          onClick={() => onAdd(product, { size: selSize, color: selColor })}
          className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-80 transition-opacity"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}