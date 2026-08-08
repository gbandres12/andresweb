import { useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Sparkles, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];
const SIZES = ["PP", "P", "M", "G", "GG", "EG", "Único"];
const COLORS = ["Preto", "Branco", "Bege", "Cinza", "Azul Marinho", "Azul", "Vermelho", "Rosa", "Verde", "Amarelo", "Marrom", "Estampado", "Outro"];

export default function EntradaForm3D({ initial = {}, images = [], onDone }) {
  const { store } = useStore();
  const [form, setForm] = useState({
    name: initial.suggested_name || '',
    description: initial.observations || '',
    category: CATEGORIES.includes(initial.category) ? initial.category : 'Vestidos',
    price: initial.suggested_price ?? '',
    cost_price: initial.suggested_cost_price ?? '',
    size: 'M',
    color: initial.predominant_color && COLORS.includes(initial.predominant_color) ? initial.predominant_color : 'Preto',
    stock: initial.estimated_pieces ?? 1,
    ncm: initial.ncm || '',
    is_active: true,
    is_featured: false,
  });
  const [saving, setSaving] = useState(false);

  // 3D tilt (movimentação 3D)
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-80, 80], [10, -10]), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-80, 80], [-10, 10]), { stiffness: 150, damping: 18 });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Informe o nome do produto'); return; }
    if (!form.price || Number(form.price) <= 0) { toast.error('Informe o preço de venda'); return; }
    setSaving(true);
    try {
      const stock = Math.max(0, Math.round(Number(form.stock) || 0));
      const tags = [initial.season, initial.fabric].filter(Boolean);
      const product = await base44.entities.Product.create({
        store_id: store?.id,
        name: form.name.trim(),
        description: form.description || '',
        category: form.category,
        price: Number(form.price),
        cost_price: Number(form.cost_price) || 0,
        ncm: form.ncm?.trim() || '',
        images,
        variants: [{ size: form.size, color: form.color, stock, sku: '' }],
        is_active: form.is_active,
        is_featured: form.is_featured,
        tags,
      });
      if (stock > 0) {
        await base44.entities.StockMovement.create({
          store_id: store?.id,
          product_id: product.id,
          product_name: product.name,
          variant_size: form.size,
          variant_color: form.color,
          type: 'entrada',
          quantity: stock,
          reason: 'Entrada por reconhecimento de fardo (IA)',
        });
      }
      toast.success('Produto cadastrado e entrada de estoque registrada');
      onDone?.();
    } catch (e) {
      toast.error('Erro ao salvar: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {/* Formulário dinâmico */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-5"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>IA preencheu os campos. Confira, ajuste e salve.</span>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Nome do produto</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Vestido Midi Floral" className="h-10" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Descrição simples</Label>
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Toque, modelo, observações..." rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Categoria</Label>
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Preço de venda (R$)</Label>
            <Input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} className="h-10 tabular-nums" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Custo (R$)</Label>
            <Input type="number" step="0.01" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} className="h-10 tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Tamanho</Label>
            <Select value={form.size} onValueChange={v => set('size', v)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Cor</Label>
            <Select value={form.color} onValueChange={v => set('color', v)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Quantidade no fardo (estoque)</Label>
          <Input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} className="h-10 tabular-nums" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">NCM (código fiscal)</Label>
          <Input value={form.ncm} onChange={e => set('ncm', e.target.value)} placeholder="Ex: 6104.42.00" className="h-10" />
        </div>

        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
            <span className="text-sm text-foreground">Ativo no catálogo</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Switch checked={form.is_featured} onCheckedChange={v => set('is_featured', v)} />
            <span className="text-sm text-foreground">Destaque</span>
          </label>
        </div>

        <Button onClick={save} disabled={saving} className="w-full h-11 text-base">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar e dar entrada no estoque
        </Button>
      </motion.div>

      {/* Preview 3D */}
      <div style={{ perspective: 1200 }} className="sticky top-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
          transition={{ opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
          onMouseMove={e => {
            const r = e.currentTarget.getBoundingClientRect();
            mx.set(e.clientX - (r.left + r.width / 2));
            my.set(e.clientY - (r.top + r.height / 2));
          }}
          onMouseLeave={() => { mx.set(0); my.set(0); }}
          style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
          className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden cursor-default"
        >
          <div style={{ transform: 'translateZ(40px)' }} className="aspect-[4/3] bg-muted relative">
            {images[0] ? (
              <img src={images[0]} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">👗</div>
            )}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {form.category}
            </div>
            {initial.confidence && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-card/90 backdrop-blur text-[11px] font-semibold flex items-center gap-1">
                <BadgeCheck className="w-3 h-3 text-emerald-600" /> IA {initial.confidence}
              </div>
            )}
          </div>
          <div style={{ transform: 'translateZ(25px)' }} className="p-5 space-y-2">
            <h3 className="text-lg font-semibold text-foreground leading-tight">{form.name || 'Nome do produto'}</h3>
            {form.description && <p className="text-sm text-muted-foreground line-clamp-2">{form.description}</p>}
            <div className="flex items-end justify-between pt-1">
              <div>
                <p className="text-2xl font-semibold text-primary tabular-nums">R$ {Number(form.price || 0).toFixed(2).replace('.', ',')}</p>
                <p className="text-xs text-muted-foreground">{form.color} · Tam {form.size}</p>
              </div>
              <span className={cn("text-sm font-semibold px-2.5 py-1 rounded-full", Number(form.stock) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive")}>
                {Number(form.stock) || 0} un
              </span>
            </div>
          </div>
        </motion.div>
        <p className="text-center text-xs text-muted-foreground mt-3">Preview interativo — mova o cursor sobre o card</p>
      </div>
    </div>
  );
}