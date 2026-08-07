import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function TransferVoucher({ transfer }) {
  const t = transfer;
  const items = t.items || [];
  const totalQty = t.total_quantity || items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalRecv = items.reduce((s, i) => s + (i.received_quantity || 0), 0);

  const coupon = (
    <div className="print-area">
      <div className="max-w-md mx-auto p-5 font-sans text-black text-sm bg-white">
        <div className="text-center border-b-2 border-black pb-2 mb-3">
          <h1 className="text-lg font-bold uppercase tracking-wide">Guia de Transferência</h1>
          <p className="font-mono text-sm">{t.transfer_number}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div><p className="font-semibold">Origem</p><p>{t.origin_store_name}</p></div>
          <div><p className="font-semibold">Destino</p><p>{t.destination_store_name}</p></div>
          <div><p className="font-semibold">Emissão</p><p>{t.dispatched_at ? new Date(t.dispatched_at).toLocaleString('pt-BR') : '—'}</p></div>
          <div><p className="font-semibold">Recebimento</p><p>{t.received_at ? new Date(t.received_at).toLocaleString('pt-BR') : '—'}</p></div>
        </div>
        <table className="w-full text-xs border border-black mb-3 border-collapse">
          <thead>
            <tr className="bg-black/10">
              <th className="border border-black p-1 text-left">Produto</th>
              <th className="border border-black p-1">Tam</th>
              <th className="border border-black p-1">Cor</th>
              <th className="border border-black p-1">Enviado</th>
              <th className="border border-black p-1">Recebido</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="border border-black p-1">{it.product_name}</td>
                <td className="border border-black p-1 text-center">{it.variant_size || '-'}</td>
                <td className="border border-black p-1 text-center">{it.variant_color || '-'}</td>
                <td className="border border-black p-1 text-center font-bold">{it.quantity}</td>
                <td className="border border-black p-1 text-center">{it.received_quantity ?? '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="border border-black p-1 font-bold" colSpan={3}>Total</td>
              <td className="border border-black p-1 text-center font-bold">{totalQty}</td>
              <td className="border border-black p-1 text-center font-bold">{totalRecv || '—'}</td>
            </tr>
          </tfoot>
        </table>
        {t.notes && <p className="text-xs mb-3"><strong>Obs:</strong> {t.notes}</p>}
        {t.loss_notes && <p className="text-xs text-rose-700 mb-3"><strong>Perdas:</strong> {t.loss_notes}</p>}
        <div className="grid grid-cols-2 gap-6 mt-10 text-xs">
          <div className="border-t border-black pt-1"><p>Originado por:</p><p className="font-medium">{t.dispatched_by || '—'}</p></div>
          <div className="border-t border-black pt-1"><p>Recebido por:</p><p className="font-medium">{t.received_by || '____________________'}</p></div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {createPortal(coupon, document.body)}
      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Imprimir guia</Button>
      </div>
    </div>
  );
}