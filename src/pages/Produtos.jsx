import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ProductForm from '@/components/ProductForm';
import { cn } from '@/lib/utils';

const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];

export default function Produtos() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => base44.entities.Product.list('-created_date').then(p => { setProducts(p); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const toggleActive = async (product) => {
    await base44.entities.Product.update(product.id, { is_active: !product.is_active });
    load();
  };

  const toggleFeatured = async (product) => {
    await base44.entities.Product.update(product.id, { is_featured: !product.is_featured });
    load();
  };

  const deleteProduct = async (id) => {
    await base44.entities.Product.delete(id);
    toast.success('Produto excluído');
    load();
  };

  const openEdit = (product) => { setEditing(product); setShowForm(true); };
  const openNew = () => { setEditing(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); load(); };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Produtos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{products.length} produtos cadastrados</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo Produto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Produto</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Categoria</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Preço</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Estoque</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product, i) => {
              const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
              return (
                <tr key={product.id} className={cn("border-b border-border last:border-0 hover:bg-muted/30 transition-colors", i % 2 === 0 ? '' : '')}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">👗</div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        {product.is_featured && <span className="text-xs text-amber-500">★ Destaque</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">{product.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-primary">R$ {product.price?.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={cn("text-sm", totalStock === 0 ? "text-destructive" : totalStock <= 5 ? "text-amber-500" : "text-muted-foreground")}>
                      {totalStock} unid.
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      product.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    )}>
                      {product.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => toggleFeatured(product)} title="Destaque" className={cn("p-1.5 rounded-lg hover:bg-muted", product.is_featured ? "text-amber-400" : "text-muted-foreground")}>
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleActive(product)} title={product.is_active ? 'Desativar' : 'Ativar'} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                        {product.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => openEdit(product)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteProduct(product.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12">Nenhum produto encontrado</div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <ProductForm product={editing} onClose={closeForm} />
        </DialogContent>
      </Dialog>
    </div>
  );
}