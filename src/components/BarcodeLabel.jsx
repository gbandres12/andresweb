import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function BarcodeLabel({ product, price }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const code = String(product?.gtin || product?.id?.slice(-10) || '000000');
    try {
      JsBarcode(ref.current, code, {
        format: 'CODE128',
        width: 1.8,
        height: 42,
        displayValue: true,
        fontSize: 11,
        margin: 2,
        textMargin: 2,
      });
    } catch {
      /* código inválido — ignora */
    }
  }, [product?.gtin, product?.id]);

  return (
    <div
      className="print-label bg-white border border-black/80 flex flex-col items-center justify-between p-2 mx-auto"
      style={{ width: '6.8cm', minHeight: '3.4cm' }}
    >
      <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full text-black">
        {product?.name || 'Produto'}
      </p>
      <canvas ref={ref} />
      <div className="flex items-center justify-between w-full px-0.5">
        <span className="text-[10px] text-black/70 tabular-nums">{product?.gtin || '—'}</span>
        <span className="text-sm font-bold text-black">{fmt(price)}</span>
      </div>
    </div>
  );
}