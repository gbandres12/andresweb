import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowDown, ArrowUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Estoque() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustData, setAdjustData] = useState({ product: null, variant: null, type: 'entrada', qty: 1, reason: '' });
  const [filterStatus, setFilterStatus] = useState('all');

  const load = () => base44.entities.Product.list().then(p => { setProducts(p); setLoading(false); });
  useEffect(() => { load(); }, []);

  // Flatten all variants with product info
  const allVariants = products.flatMap(p =>
    (p.variants || []).map(v => ({ ...v, productId: p.id, productName: p.name, productImage: p.images?.[0], category: p.category }))
  );

  const filtered = allVariants.filter(v => {
    if (filterStatus === 'low') return v.stock > 0 && v.stock <= 3;
    if (filterStatus === 'out') return v.stock === 0;
    if (filterStatus === 'ok') return v.stock > 3;
    return true;
  });

  const openAdjust = (product, variant) => {
    setAdjustData({ product, variant, type: 'entrada', qty: 1, reason: '' });
    setShowAdjust(true);
  };

  const applyAdjust = async () => {
    const { product, variant, type, qty, reason } = adjustData;
    if (!qty || qty <= 0) { toast.error('Quantidade inválida'); return; }

    const prod = products.find(p => p.id === product.productId);
    const updatedVariants = prod.variants.map(v => {
      if (v.size === variant.size && v.color === variant.color) {
        const delta = type === 'entrada' ? qty : type === 'saida' ? -qty : 0;
        const newStock = type === 'ajuste' ? qty : Math.max(0, (v.stock || 0) + delta);
        return { ...v, stock: newStock };
      }
      return v;
    });

    await base44.entities.Product.update(prod.id, { variants: updatedVariants });
    await base44.entities.StockMovement.create({
      product_id: prod.id,
      product_name: prod.name,
      variant_size: variant.size,
      variant_color: variant.color,
      type,
      quantity: qty,
      reason,
    });

    toast.success('Estoque atualizado');
    setShowAdjust(false);
    load();
  };

  const outCount = allVariants.filter(v => v.stock === 0).length;
  const lowCount = allVariants.filter(v => v.stock > 0 && v.stock <= 3).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Controle de Estoque</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{allVariants.length} variantes cadastradas</p>
        </div>
      </div>

      {/* Alerts */}
      {(outCount > 0 || lowCount > 0) && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {outCount > 0 && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2.5 rounded-xl text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {outCount} variante(s) sem estoque
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2.5 rounded-xl text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {lowCount} variante(s) com estoque baixo
            </div>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { val: 'all', label: 'Todos' },
          { val: 'ok', label: 'Em estoque' },
          { val: 'low', label: 'Estoque baixo' },
          { val: 'out', label: 'Sem estoque' },
        ].map(f => (
          <button
            key={f.val}
            onClick={() => setFilterStatus(f.val)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              filterStatus === f.val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Produto</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Tamanho</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Cor</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Estoque</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {v.productImage ? (
                      <img src={v.productImage} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">👗</div>
                    )}
                    <span className="font-medium text-sm">{v.productName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{v.size || '-'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{v.color || '-'}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-sm font-semibold",
                    v.stock === 0 ? "text-destructive" : v.stock <= 3 ? "text-amber-500" : "text-green-600"
                  )}>
                    {v.stock} un
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => openAdjust(v, v)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Ajustar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12">Nenhuma variante encontrada</div>
        )}
      </div>

      {/* Adjust dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Ajustar Estoque</DialogTitle>
          </DialogHeader>
          {adjustData.product && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3 text-sm">
                <p className="font-medium">{adjustData.product.productName}</p>
                <p className="text-muted-foreground">{adjustData.variant.size} · {adjustData.variant.color} · Atual: {adjustData.variant.stock} un</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Tipo de Movimentação</label>
                <Select value={adjustData.type} onValueChange={v => setAdjustData(d => ({ ...d, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada (+ estoque)</SelectItem>
                    <SelectItem value="saida">Saída (- estoque)</SelectItem>
                    <SelectItem value="ajuste">Ajuste (definir valor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {adjustData.type === 'ajuste' ? 'Novo valor do estoque' : 'Quantidade'}
                </label>
                <Input 
                  type="number" 
                  min="0"
                  value={adjustData.qty} 
                  onChange={e => setAdjustData(d => ({ ...d, qty: Number(e.target.value) }))} 
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Motivo (opcional)</label>
                <Input 
                  value={adjustData.reason} 
                  onChange={e => setAdjustData(d => ({ ...d, reason: e.target.value }))}
                  placeholder="Ex: Recebimento de mercadoria, ajuste de inventário..."
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowAdjust(false)} className="flex-1">Cancelar</Button>
                <Button onClick={applyAdjust} className="flex-1">Confirmar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}