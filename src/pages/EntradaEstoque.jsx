import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Plus, Minus, Package, Check, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ProductDetailModal from '@/components/ProductDetailModal';

export default function EntradaEstoque() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [quantities, setQuantities] = useState({}); // key: `${productId}-${size}-${color}` -> qty
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reason, setReason] = useState('Recebimento de mercadoria');

  const load = () => {
    base44.entities.Product.list().then(p => {
      setProducts(p);
      setLoading(false);
    });
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const setQty = (productId, size, color, val) => {
    const key = `${productId}-${size}-${color}`;
    const num = Math.max(0, Number(val) || 0);
    setQuantities(q => ({ ...q, [key]: num }));
  };

  const getQty = (productId, size, color) => {
    const key = `${productId}-${size}-${color}`;
    return quantities[key] || 0;
  };

  const adjustQty = (productId, size, color, delta) => {
    const key = `${productId}-${size}-${color}`;
    const current = quantities[key] || 0;
    setQuantities(q => ({ ...q, [key]: Math.max(0, current + delta) }));
  };

  // Count how many products have pending entries
  const pendingCount = Object.values(quantities).filter(v => v > 0).length;

  const applyAll = async () => {
    const entries = Object.entries(quantities).filter(([, qty]) => qty > 0);
    if (!entries.length) { toast.error('Nenhuma quantidade informada'); return; }
    setSaving(true);

    for (const [key, qty] of entries) {
      const [productId, ...rest] = key.split('-');
      // size and color might contain hyphens, so reconstruct
      const parts = rest;
      // We stored it as `productId-size-color`
      // Find the variant to identify size/color
      const prod = products.find(p => p.id === productId);
      if (!prod) continue;

      // Find which variant matches
      const variant = prod.variants?.find(v => {
        const k = `${productId}-${v.size}-${v.color}`;
        return k === key;
      });
      if (!variant) continue;

      const updatedVariants = prod.variants.map(v => {
        if (v.size === variant.size && v.color === variant.color) {
          return { ...v, stock: (v.stock || 0) + qty };
        }
        return v;
      });

      await base44.entities.Product.update(prod.id, { variants: updatedVariants });
      await base44.entities.StockMovement.create({
        product_id: prod.id,
        product_name: prod.name,
        variant_size: variant.size,
        variant_color: variant.color,
        type: 'entrada',
        quantity: qty,
        reason,
      });
    }

    toast.success(`${entries.length} variante(s) atualizada(s) com sucesso!`);
    setQuantities({});
    setSaving(false);
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Entrada de Estoque</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Selecione os produtos e informe as quantidades recebidas</p>
        </div>
        {pendingCount > 0 && (
          <Button onClick={applyAll} disabled={saving} className="shrink-0">
            {saving ? 'Salvando...' : (
              <><Check className="w-4 h-4 mr-1" /> Confirmar entrada ({pendingCount})</>
            )}
          </Button>
        )}
      </div>

      {/* Reason */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <label className="text-sm font-medium block mb-1.5">Motivo da entrada</label>
        <Input
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex: Recebimento de mercadoria, ajuste de inventário..."
        />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto ou categoria..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {filtered.map(product => {
          const isOpen = expanded[product.id];
          const productPending = product.variants?.reduce((sum, v) => {
            return sum + (getQty(product.id, v.size, v.color) || 0);
          }, 0);
          const totalStock = product.variants?.reduce((s, v) => s + (v.stock || 0), 0) || 0;

          return (
            <div key={product.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Product header row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(product.id)}
              >
                <button
                  onClick={e => { e.stopPropagation(); setSelectedProduct(product); }}
                  className="shrink-0"
                >
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-14 h-14 rounded-xl object-cover border border-border hover:ring-2 hover:ring-primary transition-all"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-2xl">👗</div>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={cn(
                      "text-xs font-medium",
                      totalStock === 0 ? "text-destructive" : totalStock <= 5 ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      Estoque atual: {totalStock} un
                    </span>
                    {productPending > 0 && (
                      <span className="text-xs text-green-600 font-semibold">+{productPending} entrada</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{product.variants?.length || 0} variante(s)</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Variants */}
              {isOpen && (
                <div className="border-t border-border bg-muted/20 p-4">
                  {!product.variants?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-3">Nenhuma variante cadastrada</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="grid grid-cols-4 gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1">
                        <span>Tamanho</span>
                        <span>Cor</span>
                        <span>Estoque atual</span>
                        <span>Adicionar</span>
                      </div>
                      {product.variants.map((v, i) => {
                        const qty = getQty(product.id, v.size, v.color);
                        return (
                          <div key={i} className="grid grid-cols-4 gap-3 items-center bg-card rounded-xl px-3 py-2.5 border border-border">
                            <span className="text-sm font-medium">{v.size || '-'}</span>
                            <span className="text-sm text-muted-foreground">{v.color || '-'}</span>
                            <span className={cn(
                              "text-sm font-semibold",
                              v.stock === 0 ? "text-destructive" : v.stock <= 3 ? "text-amber-500" : "text-green-600"
                            )}>
                              {v.stock || 0} un
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => adjustQty(product.id, v.size, v.color, -1)}
                                className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <Input
                                type="number"
                                min="0"
                                value={qty || ''}
                                onChange={e => setQty(product.id, v.size, v.color, e.target.value)}
                                placeholder="0"
                                className={cn(
                                  "h-8 w-16 text-center text-sm",
                                  qty > 0 && "border-green-400 text-green-700 font-semibold"
                                )}
                              />
                              <button
                                onClick={() => adjustQty(product.id, v.size, v.color, 1)}
                                className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12">Nenhum produto encontrado</div>
        )}
      </div>

      {/* Floating confirm button */}
      {pendingCount > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <Button onClick={applyAll} disabled={saving} size="lg" className="shadow-xl">
            {saving ? 'Salvando...' : (
              <><Check className="w-4 h-4 mr-2" /> Confirmar {pendingCount} entrada(s)</>
            )}
          </Button>
        </div>
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}