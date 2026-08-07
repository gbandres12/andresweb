import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tags, Loader2 } from 'lucide-react';

export default function CategoryReference() {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    base44.entities.Category.list('order')
      .then(setCats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Tags className="w-4 h-4" /> Categorias
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Referência de categorias</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : cats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma categoria cadastrada com código.</p>
        ) : (
          <div className="space-y-0 max-h-96 overflow-y-auto">
            {cats.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
                <span className="text-sm font-medium text-foreground">{c.name}</span>
                <span className="text-sm font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {c.code || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}