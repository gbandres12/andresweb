import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductDetailModal({ product, onClose }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  if (!product) return null;

  const images = product.images?.length ? product.images : [];
  const totalStock = product.variants?.reduce((s, v) => s + (v.stock || 0), 0) || 0;

  // Compute available sizes
  const sizes = [...new Set(product.variants?.map(v => v.size).filter(Boolean))];
  // Colors available for selected size (or all if none selected)
  const colors = [...new Set(
    product.variants
      ?.filter(v => !selectedSize || v.size === selectedSize)
      .map(v => v.color)
      .filter(Boolean)
  )];

  // Stock for current selection
  const getVariantStock = (size, color) => {
    const v = product.variants?.find(v => v.size === size && v.color === color);
    return v?.stock || 0;
  };

  const isSizeOutOfStock = (size) => {
    return !product.variants?.some(v => v.size === size && (v.stock || 0) > 0);
  };

  const isColorOutOfStock = (color) => {
    const v = product.variants?.find(v =>
      v.color === color && (!selectedSize || v.size === selectedSize)
    );
    return !v || (v.stock || 0) === 0;
  };

  const currentStock = selectedSize && selectedColor
    ? getVariantStock(selectedSize, selectedColor)
    : null;

  const prevImg = () => setImgIndex(i => (i - 1 + images.length) % images.length);
  const nextImg = () => setImgIndex(i => (i + 1) % images.length);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col md:flex-row">
            {/* ── Images ── */}
            <div className="md:w-1/2 bg-muted rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none overflow-hidden flex flex-col">
              <div className="relative aspect-[3/4]">
                {images[imgIndex] ? (
                  <img
                    src={images[imgIndex]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-7xl bg-muted">👗</div>
                )}
                {totalStock === 0 && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="bg-white text-black text-xs font-medium px-4 py-1.5 rounded-full">Sem estoque</span>
                  </div>
                )}
                {images.length > 1 && (
                  <>
                    <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors shadow">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors shadow">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIndex(i)}
                      className={cn(
                        "w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                        imgIndex === i ? "border-primary" : "border-transparent opacity-60 hover:opacity-90"
                      )}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info ── */}
            <div className="md:w-1/2 p-6 flex flex-col relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{product.category}</p>
              <h2 className="font-serif text-2xl font-light leading-snug mb-2">{product.name}</h2>
              <p className="text-2xl font-serif text-primary font-medium mb-4">
                R$ {product.price?.toFixed(2).replace('.', ',')}
              </p>

              {product.description && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{product.description}</p>
              )}

              {/* Sizes */}
              {sizes.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Tamanho</p>
                  <div className="flex gap-2 flex-wrap">
                    {sizes.map(size => {
                      const outOfStock = isSizeOutOfStock(size);
                      return (
                        <button
                          key={size}
                          onClick={() => { setSelectedSize(s => s === size ? '' : size); setSelectedColor(''); }}
                          disabled={outOfStock}
                          className={cn(
                            "min-w-[2.5rem] h-10 px-3 rounded-lg border text-sm font-medium transition-all",
                            selectedSize === size
                              ? "border-primary bg-primary text-primary-foreground"
                              : outOfStock
                              ? "border-border text-muted-foreground/40 line-through cursor-not-allowed bg-muted/30"
                              : "border-border hover:border-primary text-foreground"
                          )}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colors */}
              {colors.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Cor</p>
                  <div className="flex gap-2 flex-wrap">
                    {colors.map(color => {
                      const outOfStock = isColorOutOfStock(color);
                      return (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(c => c === color ? '' : color)}
                          disabled={outOfStock}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-sm transition-all",
                            selectedColor === color
                              ? "border-primary bg-primary text-primary-foreground"
                              : outOfStock
                              ? "border-border text-muted-foreground/40 line-through cursor-not-allowed bg-muted/30"
                              : "border-border hover:border-primary text-foreground"
                          )}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stock indicator */}
              {currentStock !== null && (
                <div className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-lg mb-4 w-fit",
                  currentStock === 0 ? "bg-destructive/10 text-destructive" :
                  currentStock <= 3 ? "bg-amber-50 text-amber-600" :
                  "bg-green-50 text-green-600"
                )}>
                  {currentStock === 0 ? 'Sem estoque' : `${currentStock} unidade(s) disponível(is)`}
                </div>
              )}

              {/* Tags */}
              {product.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {product.tags.map(t => (
                    <span key={t} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">#{t}</span>
                  ))}
                </div>
              )}

              {/* Variants summary */}
              <div className="mt-auto pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Estoque por variante</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {product.variants?.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{v.size} · {v.color}</span>
                      <span className={cn(
                        "font-medium",
                        v.stock === 0 ? "text-destructive" : v.stock <= 3 ? "text-amber-500" : "text-green-600"
                      )}>{v.stock} un</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}