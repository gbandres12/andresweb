import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, X, Phone, Instagram, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import CartDrawer from '@/components/CartDrawer';

const CATEGORIES = ["Todos", "Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];

export default function Catalogo() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [pickedSize, setPickedSize] = useState(null);
  const [pickedColor, setPickedColor] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openSearch = () => setSearchOpen(true);
  const closeSearch = () => { setSearchOpen(false); setSearch(''); };

  useEffect(() => {
    base44.entities.Product.filter({ is_active: true }).then(p => {
      setProducts(p);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selected) {
      setSelectedImage(0);
      setPickedSize(getAvailableSizes(selected)[0]?.size || null);
      setPickedColor(getAvailableColors(selected)[0]?.color || null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  const featured = products.filter(p => p.is_featured);
  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = category === 'Todos' || p.category === category;
    return matchSearch && matchCat;
  });

  const getTotalStock = (product) =>
    product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;

  const getAvailableSizes = (product) =>
    [...new Map(product.variants?.filter(v => v.stock > 0).map(v => [v.size, v])).values()];

  const getAvailableColors = (product) =>
    [...new Map(product.variants?.filter(v => v.stock > 0).map(v => [v.color, v])).values()];

  const addToCart = (product, size, color) => {
    const variant = product.variants?.find(v => v.size === size && v.color === color) || product.variants?.[0];
    setCart(prev => {
      const existing = prev.findIndex(i => i.productId === product.id && i.size === size && i.color === color);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 };
        return updated;
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        size,
        color,
        image: product.images?.[0],
        qty: 1,
      }];
    });
    setSelected(null);
    setCartOpen(true);
  };

  const handleWhatsApp = (product) => {
    const msg = encodeURIComponent(`Olá! Vi o catálogo da Sra Andres e tenho interesse:\n\n*${product.name}*\nR$ ${product.price?.toFixed(2)}\n\nPoderia me ajudar?`);
    window.open(`https://wa.me/55?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] font-sans">

      {/* ── STICKY NAV BAR ── */}
      <div className={cn(
        "sticky top-0 z-40 bg-[#faf9f7]/95 backdrop-blur-sm border-b border-[#e8e0d8] transition-shadow duration-300",
        scrolled ? "shadow-sm" : ""
      )}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14 gap-4">
          {/* Logo compact */}
          <span className="font-serif text-xl font-light tracking-[0.2em] shrink-0">SRA ANDRES</span>

          {/* Category pills — hidden when search is open */}
          <nav className={cn(
            "hidden md:flex items-center gap-0 overflow-x-auto flex-1 justify-center transition-all",
            searchOpen ? "opacity-0 pointer-events-none" : "opacity-100"
          )}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-4 py-1 text-xs tracking-widest uppercase transition-all font-sans whitespace-nowrap",
                  category === cat
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                )}
              >
                {cat}
              </button>
            ))}
          </nav>

          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 hover:bg-[#ede8e2] rounded-full transition-colors"
            title="Meu pedido"
          >
            <ShoppingBag className="w-4 h-4 text-foreground" />
            {cart.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </button>

          {/* Search bar — expands inline */}
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  key="searchbar"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '100%', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-x-0 top-0 h-14 bg-[#faf9f7] flex items-center px-6 gap-3 z-10"
                >
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por nome, categoria, tag..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
                  />
                  {search && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {products.filter(p => {
                        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
                        const matchCat = category === 'Todos' || p.category === category;
                        return p.is_active && matchSearch && matchCat;
                      }).length} resultado(s)
                    </span>
                  )}
                  <button onClick={closeSearch} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={openSearch}
              className="p-2 hover:bg-[#ede8e2] rounded-full transition-colors"
              title="Buscar"
            >
              <Search className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>

        {/* Mobile category scroll */}
        <div className="md:hidden flex gap-0 overflow-x-auto px-4 pb-2 border-t border-[#e8e0d8]/60">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1.5 text-xs tracking-widest uppercase transition-all font-sans whitespace-nowrap shrink-0",
                category === cat
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground border-b-2 border-transparent"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── HERO BRAND ── */}
      <header className="bg-[#faf9f7] border-b border-[#e8e0d8]">
        {/* Top info bar */}
        <div className="border-b border-[#e8e0d8] py-2 px-6 flex items-center justify-between text-xs tracking-widest uppercase text-muted-foreground">
          <span>Frete grátis acima de R$ 299</span>
          <div className="flex gap-5">
            <a href="https://wa.me/55" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1.5">
              <Phone className="w-3 h-3" /> WhatsApp
            </a>
            <a href="#" className="hover:text-foreground transition-colors flex items-center gap-1.5">
              <Instagram className="w-3 h-3" /> Instagram
            </a>
          </div>
        </div>

        {/* Brand */}
        <div className="py-10 flex flex-col items-center text-center px-6">
        <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">Moda Feminina</p>
        <h1 className="font-serif text-5xl md:text-7xl font-light text-foreground" style={{ letterSpacing: '0.15em' }}>
          SRA ANDRES
        </h1>
          <div className="w-16 h-px bg-primary/40 my-4" />
          <p className="font-serif text-sm italic text-muted-foreground">moda feminina com estilo</p>
          {/* Inline search hint */}
          <button
            onClick={openSearch}
            className="mt-6 flex items-center gap-3 border border-[#d4c9bf] px-6 py-2.5 text-xs tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-foreground transition-all group"
          >
            <Search className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
            Buscar peças, categorias...
            <span className="ml-2 text-[10px] bg-[#ede8e2] px-1.5 py-0.5 rounded">⌘ K</span>
          </button>
        </div>
      </header>

      {/* ── FEATURED STRIP ── */}
      {featured.length > 0 && !search && category === 'Todos' && (
        <section className="max-w-6xl mx-auto px-6 mb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-[#e8e0d8]" />
            <p className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">Destaques</p>
            <div className="h-px flex-1 bg-[#e8e0d8]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {featured.slice(0, 4).map((p, i) => (
              <FeaturedCard key={p.id} product={p} index={i} onClick={() => setSelected(p)} />
            ))}
          </div>
        </section>
      )}

      {/* ── MAIN GRID ── */}
      <main className="max-w-6xl mx-auto px-6 pb-24">
        {!loading && (
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-[#e8e0d8]" />
            <p className="text-xs tracking-[0.25em] uppercase text-muted-foreground">
              {filtered.length} peça{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="h-px flex-1 bg-[#e8e0d8]" />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="rounded-none bg-[#ede8e2] animate-pulse" style={{ aspectRatio: '3/4' }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} onClick={() => setSelected(product)} />
            ))}
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#e8e0d8] bg-[#f5f1ed] py-12 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h3 className="font-serif text-2xl font-light tracking-widest mb-3">SRA ANDRES</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Moda feminina com estilo e personalidade para cada momento da sua vida.
            </p>
          </div>
          <div>
            <p className="text-xs tracking-widest uppercase mb-4 text-foreground">Atendimento</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a href="https://wa.me/55" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-foreground transition-colors justify-center md:justify-start">
                <Phone className="w-3.5 h-3.5" /> WhatsApp
              </a>
              <a href="#" className="flex items-center gap-2 hover:text-foreground transition-colors justify-center md:justify-start">
                <Instagram className="w-3.5 h-3.5" /> @sraandres
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs tracking-widest uppercase mb-4 text-foreground">Informações</p>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>Trocas em até 30 dias</p>
              <p>Frete grátis acima de R$ 299</p>
              <p>Pagamento via PIX com desconto</p>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-[#e8e0d8] text-center text-xs text-muted-foreground tracking-wider">
          © {new Date().getFullYear()} Bella Store · Todos os direitos reservados
        </div>
      </footer>

      {/* ── CART DRAWER ── */}
      <AnimatePresence>
        {cartOpen && (
          <CartDrawer
            cart={cart}
            onRemove={(i) => setCart(prev => prev.filter((_, idx) => idx !== i))}
            onClose={() => setCartOpen(false)}
            storePhone="55"
          />
        )}
      </AnimatePresence>

      {/* ── PRODUCT MODAL ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center"
            onClick={() => setSelected(null)}
          >
            <motion.div
              key="modal"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white w-full md:max-w-3xl md:rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col md:flex-row">
                {/* Images */}
                <div className="md:w-1/2 bg-[#f5f1ed] relative">
                  <div className="aspect-[3/4] relative overflow-hidden">
                    {selected.images?.[selectedImage] ? (
                      <img
                        src={selected.images[selectedImage]}
                        alt={selected.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-7xl bg-[#ede8e2]">👗</div>
                    )}
                    {getTotalStock(selected) === 0 && (
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <span className="bg-white text-black text-xs tracking-widest uppercase px-4 py-2">Esgotado</span>
                      </div>
                    )}
                  </div>
                  {/* Thumbnail strip */}
                  {selected.images?.length > 1 && (
                    <div className="flex gap-2 p-3 overflow-x-auto">
                      {selected.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImage(i)}
                          className={cn(
                            "w-14 h-14 shrink-0 overflow-hidden rounded",
                            selectedImage === i ? "ring-2 ring-primary" : "opacity-60"
                          )}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="md:w-1/2 p-8 flex flex-col">
                  <button
                    onClick={() => setSelected(null)}
                    className="self-end text-muted-foreground hover:text-foreground mb-4 md:mb-0 md:absolute md:top-4 md:right-4"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <p className="text-xs tracking-[0.25em] uppercase text-muted-foreground mb-2">{selected.category}</p>
                  <h2 className="font-serif text-2xl font-light leading-snug mb-4">{selected.name}</h2>
                  <p className="font-serif text-3xl font-light text-primary mb-5">
                    R$ {selected.price?.toFixed(2).replace('.', ',')}
                  </p>

                  {selected.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">{selected.description}</p>
                  )}

                  {/* Sizes */}
                  {getAvailableSizes(selected).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Tamanho</p>
                      <div className="flex gap-2 flex-wrap">
                        {getAvailableSizes(selected).map(v => (
                          <button
                            key={v.size}
                            onClick={() => setPickedSize(v.size)}
                            className={cn(
                              "w-10 h-10 border flex items-center justify-center text-sm transition-colors",
                              pickedSize === v.size ? "border-primary bg-primary/5 text-primary font-medium" : "border-[#d4c9bf] hover:border-primary"
                            )}
                          >
                            {v.size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Colors */}
                  {getAvailableColors(selected).length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Cor</p>
                      <div className="flex gap-2 flex-wrap">
                        {getAvailableColors(selected).map(v => (
                          <button
                            key={v.color}
                            onClick={() => setPickedColor(v.color)}
                            className={cn(
                              "px-3 py-1.5 border text-xs transition-colors",
                              pickedColor === v.color ? "border-primary bg-primary/5 text-primary font-medium" : "border-[#d4c9bf] text-muted-foreground hover:border-primary"
                            )}
                          >
                            {v.color}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.tags?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-6">
                      {selected.tags.map(t => (
                        <span key={t} className="text-xs text-muted-foreground/70">#{t}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto space-y-3">
                    {getTotalStock(selected) === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3 border border-[#e8e0d8]">
                        Peça temporariamente indisponível
                      </p>
                    ) : (
                      <>
                        <button
                          onClick={() => addToCart(selected, pickedSize, pickedColor)}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3.5 text-sm tracking-widest uppercase transition-colors flex items-center justify-center gap-2.5"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          Adicionar ao Pedido
                        </button>
                        <button
                          onClick={() => handleWhatsApp(selected)}
                          className="w-full bg-[#25D366] hover:bg-[#1db954] text-white py-3 text-sm tracking-widest uppercase transition-colors flex items-center justify-center gap-2.5"
                        >
                          <Phone className="w-4 h-4" />
                          Pedir diretamente
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelected(null)}
                      className="w-full py-3 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors border border-[#e8e0d8]"
                    >
                      Continuar comprando
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ── */

function FeaturedCard({ product, index, onClick }) {
  const inStock = (product.variants?.reduce((s, v) => s + (v.stock || 0), 0) || 0) > 0;
  // First card spans 2 rows on md
  const isBig = index === 0;
  return (
    <div
      onClick={onClick}
      className={cn("group cursor-pointer relative overflow-hidden bg-[#ede8e2]", isBig ? "md:row-span-2" : "")}
      style={{ aspectRatio: isBig ? '3/4' : '3/4' }}
    >
      {product.images?.[0] ? (
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-5xl">👗</div>
      )}
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <p className="text-white font-serif text-base">{product.name}</p>
        <p className="text-white/80 text-sm">R$ {product.price?.toFixed(2).replace('.', ',')}</p>
      </div>
      {!inStock && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <span className="bg-white/90 text-black text-xs tracking-widest uppercase px-3 py-1.5">Esgotado</span>
        </div>
      )}
      <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase px-2.5 py-1">
        Destaque
      </span>
    </div>
  );
}

function ProductCard({ product, onClick }) {
  const inStock = (product.variants?.reduce((s, v) => s + (v.stock || 0), 0) || 0) > 0;
  return (
    <div onClick={onClick} className="group cursor-pointer">
      {/* Image */}
      <div className="relative overflow-hidden bg-[#ede8e2]" style={{ aspectRatio: '3/4' }}>
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">👗</div>
        )}
        {/* Second image on hover */}
        {product.images?.[1] && (
          <img
            src={product.images[1]}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          />
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <span className="bg-white/90 text-black text-xs tracking-widest uppercase px-3 py-1.5">Esgotado</span>
          </div>
        )}
        {/* Quick action */}
        <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <button className="w-full bg-white/90 backdrop-blur-sm text-foreground text-xs tracking-widest uppercase py-2.5 hover:bg-white transition-colors">
            Ver detalhes
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 space-y-0.5">
        <p className="text-xs text-muted-foreground tracking-wider uppercase">{product.category}</p>
        <p className="font-sans text-sm text-foreground font-medium leading-snug">{product.name}</p>
        <p className="font-serif text-base text-primary">R$ {product.price?.toFixed(2).replace('.', ',')}</p>
      </div>
    </div>
  );
}