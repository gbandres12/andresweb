import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Sparkles, RotateCcw, X, ImagePlus, UploadCloud, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import EntradaForm3D from './EntradaForm3D';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
      const res = await fetch('/api/classify-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_urls: images.map(i => i.url) })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      setClassification(res);
      toast.success(`Fardo analisado pela IA com sucesso! ✨`);
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
        <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Classificação e Contagem por IA Prontas</p>
                <Badge className="bg-emerald-600 text-white text-[10px] flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> {classification.provider || 'OpenRouter AI'}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {classification.category} · {classification.suggested_name} · Contagem estimada: <strong>{classification.estimated_pieces} peças</strong>
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={reset} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
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
        <div className="border-2 border-dashed border-emerald-200 rounded-2xl py-12 px-6 text-center hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
            <Camera className="w-7 h-7 text-emerald-600" />
          </div>
          <p className="text-base font-semibold text-slate-800">Fotografe ou envie fotos do fardo de roupas</p>
          <p className="text-sm text-slate-500 mt-1">A IA da OpenRouter analisa visualmente as imagens, conta a quantidade de peças e sugere o preço comercial.</p>
          <span className="inline-flex items-center gap-2 mt-4 text-sm text-emerald-600 font-medium bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
            <ImagePlus className="w-4 h-4" /> Selecionar fotos do fardo
          </span>
        </div>
      </label>

      {images.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              <button
                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center text-slate-500 hover:text-red-600"
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
        className={cn("w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md", !images.length && "opacity-60")}
      >
        {classifying ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analisando fotos e contando peças via OpenRouter IA...</>
        ) : uploading ? (
          <><UploadCloud className="w-4 h-4 mr-2" /> Enviando imagens...</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> Classificar e Contar Peças com OpenRouter IA</>
        )}
      </Button>
    </div>
  );
}