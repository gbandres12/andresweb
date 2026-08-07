import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import BarcodeLabel from '@/components/BarcodeLabel';
import { effectivePrice } from '@/lib/priceTables';

export default function LabelPrinter({ open, products, onClose }) {
  const list = products || [];
  const handlePrint = () => window.print();

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Imprimir Etiquetas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            {list.length} etiqueta(s) pronta(s) para impressão. Clique em Imprimir e use a impressora de etiquetas.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
            {list.map(p => (
              <BarcodeLabel key={p.id} product={p} price={effectivePrice(p, 'cliente_final')} />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={handlePrint} disabled={!list.length}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open && createPortal(
        <div className="print-area">
          <div className="grid grid-cols-3 gap-2 p-4">
            {list.map(p => (
              <BarcodeLabel key={p.id} product={p} price={effectivePrice(p, 'cliente_final')} />
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}