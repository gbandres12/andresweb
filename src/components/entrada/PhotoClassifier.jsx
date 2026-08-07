import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Sparkles, RotateCcw, X, ImagePlus, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import EntradaForm3D from './EntradaForm3D';
import { cn } from '@/lib/utils';

const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];

export default function PhotoClassifier() {
  const [images, setImages] = useState([]); // [{url, name}]
  const [uploading, setUploading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState(null);

  const onFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({ url: file_url, name: file.name });
      } catch {
        toast.error('Erro ao enviar imagem');
      }
    }
    setImages(prev => [...prev, ...uploaded]);
    setUploading(false);
  };

  const classify = async () => {
    if (!images.length) { toast.error('Envie ao menos uma foto do fardo'); return; }
    setClassifying(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em varejo de moda feminina (lojas de roupas). Analise a(s) foto(s) do fardo/peça de roupa e classifique para cadastro de estoque. Identifique: categoria da loja, um nome comercial curto e vendável, a cor predominante, o tecido provável, a estação (verão/inverno/multissação), o número estimado de peças no fardo, um preço de venda médio em R$ (varejo brasileiro) e um preço de custo estimado em R$. Seja objetivo e comercial. Retorne em JSON conforme o schema.`,
        file_urls: images.map(i => i.url),
        response_json_schema: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: CATEGORIES },
            suggested_name: { type: 'string' },
            predominant_color: { type: 'string' },
            fabric: { type: 'string' },
            season: { type: 'string' },
            estimated_pieces: { type: 'number' },
            suggested_price: { type: 'number' },
            suggested_cost_price: { type: 'number' },
            confidence: { type: 'string', enum: ['alta', 'média', 'baixa'] },
            observations: { type: 'string' },
          },
          required: ['category', 'suggested_name', 'estimated_pieces', 'suggested_price'],
        },
      });
      setClassification(res);
    } catch (e) {
      toast.error('Erro na classificação: ' + (e.message || ''));
    } finally {
      setClassifying(false);
    }
  };

  const reset = () => { setImages([]); setClassification(null); };

  if (classification) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Classificação pronta</p>
              <p className="text-xs text-muted-foreground">
                {classification.category} · {classification.suggested_name} · confiança {classification.confidence || '—'}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" /> Nova classificação
          </Button>
        </div>
        <EntradaForm3D initial={classification} images={images.map(i => i.url)} onDone={reset} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <label className="block group cursor-pointer">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => onFiles(Array.from(e.target.files))}
        />
        <div className="border-2 border-dashed border-border rounded-2xl py-12 px-6 text-center hover:border-primary/50 hover:bg-muted/40 transition-colors">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <p className="text-base font-semibold text-foreground">Fotografe ou envie fotos do fardo</p>
          <p className="text-sm text-muted-foreground mt-1">A IA identifica categoria, cor, peças e sugere preço</p>
          <span className="inline-flex items-center gap-2 mt-4 text-sm text-primary font-medium">
            <ImagePlus className="w-4 h-4" /> Selecionar imagens
          </span>
        </div>
      </label>

      {images.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              <button
                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/90 shadow flex items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={classify}
        disabled={!images.length || classifying || uploading}
        className={cn("w-full h-12 text-base", !images.length && "opacity-60")}
      >
        {classifying ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Classificando fardo com IA...</>
        ) : uploading ? (
          <><UploadCloud className="w-4 h-4 mr-2" /> Enviando imagens...</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> Classificar com IA</>
        )}
      </Button>
    </div>
  );
}