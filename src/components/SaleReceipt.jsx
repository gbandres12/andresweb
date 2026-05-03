import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function printReceipt(sale) {
  const date = format(new Date(sale.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const itemsRows = (sale.items || []).map(item => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0ebe5;">
        <div style="font-size: 13px;">${item.product_name}</div>
        ${item.variant_size || item.variant_color ? `<div style="font-size: 11px; color: #999;">${[item.variant_size, item.variant_color].filter(Boolean).join(' · ')}</div>` : ''}
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0ebe5; text-align: center; font-size: 13px;">${item.quantity}x</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0ebe5; text-align: right; font-size: 13px; font-weight: 600;">
        R$ ${(item.total || 0).toFixed(2).replace('.', ',')}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Recibo - Venda #${sale.sale_number}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Jost:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Jost', sans-serif;
          background: #fff;
          color: #2a2017;
          padding: 40px;
          max-width: 480px;
          margin: 0 auto;
        }
        .header { text-align: center; padding-bottom: 24px; border-bottom: 2px solid #e8e0d8; margin-bottom: 24px; }
        .brand { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 300; letter-spacing: 0.2em; color: #2a2017; }
        .subtitle { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: #9a8f85; margin-top: 4px; }
        .receipt-title { font-family: 'Cormorant Garamond', serif; font-size: 18px; margin-top: 12px; color: #7a4f5a; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 13px; }
        .meta-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #9a8f85; display: block; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .totals { background: #faf8f5; padding: 14px 16px; border-radius: 8px; }
        .totals-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; color: #7a7060; }
        .totals-final { display: flex; justify-content: space-between; font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 600; padding-top: 10px; margin-top: 8px; border-top: 1px solid #e8e0d8; color: #2a2017; }
        .footer { text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e8e0d8; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #b0a898; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">SRA ANDRES</div>
        <div class="subtitle">Moda Feminina</div>
        <div class="receipt-title">Recibo de Compra</div>
      </div>

      <div class="meta">
        <div class="meta-item"><label>Nº da Venda</label><strong>#${sale.sale_number || '—'}</strong></div>
        <div class="meta-item"><label>Data</label>${date}</div>
        ${sale.customer_name ? `<div class="meta-item"><label>Cliente</label>${sale.customer_name}</div>` : ''}
        ${sale.customer_phone ? `<div class="meta-item"><label>Telefone</label>${sale.customer_phone}</div>` : ''}
        <div class="meta-item"><label>Pagamento</label>${sale.payment_method || '—'}</div>
        ${sale.seller_name ? `<div class="meta-item"><label>Vendedora</label>${sale.seller_name}</div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.15em; color:#9a8f85; padding-bottom:8px;">Produto</th>
            <th style="text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.15em; color:#9a8f85; padding-bottom:8px;">Qtd</th>
            <th style="text-align:right; font-size:10px; text-transform:uppercase; letter-spacing:0.15em; color:#9a8f85; padding-bottom:8px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <div class="totals">
        ${sale.subtotal ? `<div class="totals-row"><span>Subtotal</span><span>R$ ${(sale.subtotal || 0).toFixed(2).replace('.', ',')}</span></div>` : ''}
        ${sale.discount > 0 ? `<div class="totals-row" style="color:#4a8c5c"><span>Desconto</span><span>- R$ ${(sale.discount || 0).toFixed(2).replace('.', ',')}</span></div>` : ''}
        <div class="totals-final"><span>Total</span><span>R$ ${(sale.total || 0).toFixed(2).replace('.', ',')}</span></div>
      </div>

      ${sale.notes ? `<p style="margin-top:16px; font-size:12px; color:#9a8f85;">Obs: ${sale.notes}</p>` : ''}

      <div class="footer">
        Obrigada pela sua compra! ♡<br/>
        Troca em até 30 dias com nota fiscal
      </div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=600,height=800');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export default function PrintReceiptButton({ sale }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => printReceipt(sale)}
      className="gap-2"
    >
      <Printer className="w-3.5 h-3.5" />
      Imprimir / PDF
    </Button>
  );
}