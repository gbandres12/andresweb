import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Plus, Minus, Trash2, ShoppingCart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PDV() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleNum, setLastSaleNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const searchRef = useRef();

  useEffect(() => {
    base44.entities.Product.filter({ is_active: true }).then(setProducts);
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal - (discount || 0));

  const getProductStock = (product, size, color) => {
    const v = product.variants?.find(v => v.size === size && v.color === color);
    return v?.stock || 0;
  };

  const addToCart = (product, variant) => {
    const key = `${product.id}-${variant.size}-${variant.color}`;
    const existing = cart.find(i => i.key === key);
    const stock = getProductStock(product, variant.size, variant.color);

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
        unit_price: product.price,
        total: product.price,
      }]);
    }
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
    setLoading(true);

    const saleNum = `VND-${Date.now().toString().slice(-6)}`;
    const saleData = {
      sale_number: saleNum,
      items: cart.map(({ key, ...i }) => i),
      subtotal,
      discount: discount || 0,
      total,
      payment_method: paymentMethod,
      customer_name: customerName,
      customer_phone: customerPhone,
      notes,
      status: 'concluida',
    };

    await base44.entities.Sale.create(saleData);

    // Update stock
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

    // Refresh products
    base44.entities.Product.filter({ is_active: true }).then(setProducts);
    setLastSaleNum(saleNum);
    setCart([]);
    setDiscount(0);
    setPaymentMethod('');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
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
              ref={searchRef}
              placeholder="Buscar produto ou categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
          {filtered.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addToCart}
              selectedVariants={selectedVariants}
              setSelectedVariants={setSelectedVariants}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12 text-base">
              Nenhum produto encontrado
            </div>
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
              {['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Misto'].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              <p className="text-xl font-serif font-semibold text-primary mt-2">R$ {total.toFixed(2).replace('.', ',')}</p>
            </div>
            <Button onClick={() => setShowSuccess(false)} className="w-full h-11">Nova Venda</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({ product, onAdd, selectedVariants, setSelectedVariants }) {
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
        <p className="text-base font-serif font-semibold text-primary mt-0.5">R$ {product.price?.toFixed(2).replace('.', ',')}</p>
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