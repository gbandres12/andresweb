import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ShoppingBag, Instagram, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ["Todos", "Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];

export default function Catalogo() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Product.filter({ is_active: true }).then(p => { setProducts(p); setLoading(false); });
  }, []);

  const featured = products.filter(p => p.is_featured);
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = category === 'Todos' || p.category === category;
    return matchSearch && matchCat;
  });

  const getTotalStock = (product) => product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;

  const handleWhatsApp = (product) => {
    const msg = encodeURIComponent(`Olá! Tenho interesse no produto: ${product.name} - R$ ${product.price?.toFixed(2)}`);
    window.open(`https://wa.me/55?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <header className="relative bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground text-2xl font-serif font-semibold">B</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-foreground tracking-wide">Bella Store</h1>
          <p className="text-muted-foreground font-sans text-sm mt-2 tracking-widest uppercase">Moda Feminina</p>
        </div>
      </header>

      {/* Featured */}
      {featured.length > 0 && !search && category === 'Todos' && (
        <section className="max-w-6xl mx-auto px-6 pt-10">
          <h2 className="font-serif text-2xl font-semibold mb-6">Destaques</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.slice(0, 4).map(product => (
              <ProductCard key={product.id} product={product} onClick={() => setSelected(product)} />
            ))}
          </div>
          <hr className="border-border mt-10" />
        </section>
      )}

      {/* Filters */}
      <section className="max-w-6xl mx-auto px-6 pt-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar peças..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl bg-background text-sm outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-sans font-medium transition-all whitespace-nowrap",
                  category === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="rounded-2xl bg-muted animate-pulse aspect-[3/4]" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{filtered.length} peça(s)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-16">
              {filtered.map(product => (
                <ProductCard key={product.id} product={product} onClick={() => setSelected(product)} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h3 className="font-serif text-lg font-semibold">Bella Store</h3>
            <p className="text-sm text-muted-foreground">Moda Feminina com elegância</p>
          </div>
          <div className="flex gap-4">
            <a href="#" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Instagram className="w-4 h-4" /> Instagram
            </a>
            <a href="https://wa.me/55" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="w-4 h-4" /> WhatsApp
            </a>
          </div>
        </div>
      </footer>

      {/* Product detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-card rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="relative">
              {selected.images?.[0] ? (
                <img src={selected.images[0]} alt={selected.name} className="w-full aspect-[4/3] object-cover rounded-t-2xl" />
              ) : (
                <div className="w-full aspect-[4/3] bg-muted rounded-t-2xl flex items-center justify-center text-6xl">👗</div>
              )}
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-sans">{selected.category}</p>
                <h2 className="font-serif text-2xl font-semibold mt-1">{selected.name}</h2>
                <p className="text-2xl font-serif font-semibold text-primary mt-2">R$ {selected.price?.toFixed(2)}</p>
              </div>
              {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}

              {selected.variants?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Tamanhos disponíveis</p>
                  <div className="flex gap-2 flex-wrap">
                    {[...new Map(selected.variants.filter(v => v.stock > 0).map(v => [v.size, v])).values()].map(v => (
                      <span key={v.size} className="px-3 py-1.5 border border-border rounded-lg text-sm">
                        {v.size}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {[...new Map(selected.variants.filter(v => v.stock > 0).map(v => [v.color, v])).values()].map(v => (
                      <span key={v.color} className="px-3 py-1.5 bg-muted rounded-lg text-sm">
                        {v.color}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {getTotalStock(selected) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Produto temporariamente indisponível</p>
              ) : (
                <button
                  onClick={() => handleWhatsApp(selected)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Phone className="w-4 h-4" /> Pedir pelo WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onClick }) {
  const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="relative rounded-2xl overflow-hidden bg-muted aspect-[3/4]">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">👗</div>
        )}
        {product.is_featured && (
          <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-sans">
            Destaque
          </span>
        )}
        {totalStock === 0 && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-white text-black text-xs px-3 py-1.5 rounded-full font-medium">Esgotado</span>
          </div>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="font-sans font-medium text-sm text-foreground truncate">{product.name}</p>
        <p className="font-serif text-base font-semibold text-primary">R$ {product.price?.toFixed(2)}</p>
      </div>
    </div>
  );
}