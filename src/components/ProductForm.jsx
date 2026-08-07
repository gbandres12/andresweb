import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Upload, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getStoreTables, effectivePrice, fmtPct } from '@/lib/priceTables';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/StoreContext';

const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];
const SIZES = ["PP", "P", "M", "G", "GG", "XG", "36", "38", "40", "42", "44", "46", "48", "Único"];
const COLORS = ["Preto", "Branco", "Bege", "Rosa", "Nude", "Vermelho", "Azul", "Verde", "Amarelo", "Laranja", "Roxo", "Cinza", "Marrom", "Estampado", "Outro"];

export default function ProductForm({ product, onClose }) {
  const { store } = useStore();
  const tables = getStoreTables(store);
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || '',
    price: product?.price || '',
    cost_price: product?.cost_price || '',
    images: product?.images || [],
    variants: product?.variants || [],
    is_active: product?.is_active ?? true,
    is_featured: product?.is_featured ?? false,
    gtin: product?.gtin || '',
    sku: product?.sku || '',
    tags: product?.tags || [],
    active_tables: product?.active_tables || [],
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const generateGtin = () => {
    // Gera um código interno de 12 dígitos (prefixo 2 = uso interno) para etiqueta
    const code = '2' + Date.now().toString().slice(-11);
    set('gtin', code);
  };

  const [suggestingSku, setSuggestingSku] = useState(false);
  const suggestSku = async () => {
    setSuggestingSku(true);
    try {
      const prompt = `Você gera códigos SKU para produtos de uma loja de roupas.
Loja: ${store?.name || ''}${store?.slug ? ' (slug: ' + store.slug + ')' : ''}.
Produto: ${form.name || '(sem nome)'}.
Categoria: ${form.category || '(sem categoria)'}.
Gere um SKU curto, até 12 caracteres, sem espaços, combinando iniciais da loja + categoria + número sequencial. Responda apenas o SKU, em maiúsculas, sem aspas.`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: { type: 'object', properties: { sku: { type: 'string' } } },
      });
      const sku = (res?.sku || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (sku) set('sku', sku);
      else toast.error('Não foi possível gerar o SKU');
    } catch {
      toast.error('Erro ao gerar SKU');
    } finally {
      setSuggestingSku(false);
    }
  };

  const addVariant = () => {
    set('variants', [...form.variants, { size: 'M', color: 'Preto', stock: 0, sku: '' }]);
  };

  const updateVariant = (i, field, val) => {
    const v = [...form.variants];
    v[i] = { ...v[i], [field]: field === 'stock' ? Number(val) : val };
    set('variants', v);
  };

  const removeVariant = (i) => {
    set('variants', form.variants.filter((_, idx) => idx !== i));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('images', [...form.images, file_url]);
    setUploading(false);
  };

  const removeImage = (i) => set('images', form.images.filter((_, idx) => idx !== i));

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      set('tags', [...form.tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const save = async () => {
    if (!form.name || !form.price || !form.category) {
      toast.error('Preencha nome, preço e categoria');
      return;
    }
    setSaving(true);
    const data = {
      ...form,
      price: Number(form.price),
      cost_price: Number(form.cost_price) || 0,
      active_tables: form.active_tables,
    };
    if (product) {
      await base44.entities.Product.update(product.id, data);
      toast.success('Produto atualizado');
    } else {
      await base44.entities.Product.create(data);
      toast.success('Produto criado');
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Nome do Produto *</label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Vestido Midi Floral" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Preço de Venda *</label>
          <Input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Preço de Custo</label>
          <Input type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} placeholder="0,00" />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Categoria *</label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">GTIN / Código de Barras (EAN)</label>
          <div className="flex gap-2">
            <Input
              value={form.gtin}
              onChange={e => set('gtin', e.target.value)}
              placeholder="Leia com o scanner USB ou digite o código"
            />
            <Button type="button" variant="outline" onClick={generateGtin}>Gerar</Button>
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">SKU (Código Interno)</label>
          <div className="flex gap-2">
            <Input
              value={form.sku}
              onChange={e => set('sku', e.target.value.toUpperCase())}
              placeholder="Ex: AND-VEST-001"
            />
            <Button type="button" variant="outline" onClick={suggestSku} disabled={suggestingSku}>
              {suggestingSku ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              Sugerir IA
            </Button>
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Descrição</label>
          <textarea 
            value={form.description} 
            onChange={e => set('description', e.target.value)}
            className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none h-20"
            placeholder="Descrição para o catálogo online..."
          />
        </div>
      </div>

      {/* Tabelas participantes */}
      <div>
        <label className="text-sm font-medium mb-2 block">Tabelas de Preço (participação)</label>
        <p className="text-xs text-muted-foreground mb-2">A margem de cada tabela é definida em Configurações e aplicada automaticamente.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tables.map(t => {
            const active = !form.active_tables.length || form.active_tables.includes(t.key);
            return (
              <div key={t.key} className={cn("rounded-xl p-3 border", active ? "bg-muted/40 border-border" : "bg-background border-dashed border-border opacity-60")}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={active} onChange={e => {
                      const next = e.target.checked
                        ? Array.from(new Set([...(form.active_tables || []), t.key]))
                        : (form.active_tables || []).filter(k => k !== t.key);
                      set('active_tables', next);
                    }} className="rounded" />
                    <span className="text-xs font-medium text-foreground">{t.name}</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">{t.payment_method}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Margem: {fmtPct(t.adjustment)}</span>
                  <span className="text-primary font-medium tabular-nums">R$ {effectivePrice({ price: Number(form.price) || 0, active_tables: form.active_tables }, t.key, tables).toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Images */}
      <div>
        <label className="text-sm font-medium mb-2 block">Fotos do Produto</label>
        <div className="flex gap-2 flex-wrap">
          {form.images.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-border" />
              <button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full text-xs items-center justify-center hidden group-hover:flex">×</button>
            </div>
          ))}
          <label className={`w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors ${uploading ? 'opacity-50' : ''}`}>
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground mt-1">{uploading ? '...' : 'Foto'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Variants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Variantes (Tamanho / Cor / Estoque)</label>
          <Button variant="outline" size="sm" onClick={addVariant}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        {form.variants.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
            Nenhuma variante. Clique em "Adicionar" para criar tamanho/cor.
          </p>
        )}
        <div className="space-y-2">
          {form.variants.map((v, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-center bg-muted/40 rounded-xl p-2">
              <Select value={v.size} onValueChange={val => updateVariant(i, 'size', val)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={v.color} onValueChange={val => updateVariant(i, 'color', val)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input 
                type="number" 
                value={v.stock} 
                onChange={e => updateVariant(i, 'stock', e.target.value)}
                className="h-8 text-xs"
                placeholder="Estoque"
              />
              <button onClick={() => removeVariant(i)} className="flex items-center justify-center text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Tags (Enter para adicionar)</label>
        <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Ex: verão, casual, floral" />
        {form.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {form.tags.map((t, i) => (
              <span key={i} className="bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {t}
                <button onClick={() => set('tags', form.tags.filter((_, idx) => idx !== i))}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
          <span className="text-sm">Ativo no catálogo</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} className="rounded" />
          <span className="text-sm">Produto em destaque</span>
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Salvando...' : 'Salvar Produto'}</Button>
      </div>
    </div>
  );
}