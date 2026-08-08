import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEFAULTS = {
  title: 'CUPOM DE CONTROLE',
  show_store_name: true,
  show_cnpj: true,
  show_address: true,
  show_phone: true,
  show_date: true,
  show_seller: true,
  show_customer: true,
  show_items: true,
  show_payment: true,
  footer: 'Obrigada pela preferencia!',
  width_mm: 80,
};

export function getCupomConfig(store) {
  return { ...DEFAULTS, ...(store?.settings?.cupom || {}) };
}

const money = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export function printControlCupom(sale, store) {
  const cfg = getCupomConfig(store);
  const date = format(new Date(sale?.created_date || Date.now()), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const w = Number(cfg.width_mm) || 80;

  const itemsRows = cfg.show_items ? (sale?.items || []).map(item => `
    <tr>
      <td style="padding:5px 0;border-bottom:1px dashed #ddd;font-size:12px;vertical-align:top;">
        ${item.product_name || ''}
        ${(item.variant_size || item.variant_color) ? `<div style="font-size:10px;color:#888;">${[item.variant_size, item.variant_color].filter(Boolean).join(' · ')}</div>` : ''}
      </td>
      <td style="padding:5px 0;border-bottom:1px dashed #ddd;text-align:center;font-size:12px;vertical-align:top;">${item.quantity}x</td>
      <td style="padding:5px 0;border-bottom:1px dashed #ddd;text-align:right;font-size:12px;font-weight:600;vertical-align:top;white-space:nowrap;">${money(item.total)}</td>
    </tr>`).join('') : '';

  const headerLines = [];
  if (cfg.show_store_name && store?.name) headerLines.push(`<div class="brand">${store.name}</div>`);
  if (cfg.title) headerLines.push(`<div class="ctitle">${cfg.title}</div>`);
  if (cfg.show_cnpj && store?.cnpj) headerLines.push(`<div class="meta">CNPJ: ${store.cnpj}</div>`);
  if (cfg.show_address && store?.address) headerLines.push(`<div class="meta">${store.address}</div>`);
  if (cfg.show_phone && store?.phone) headerLines.push(`<div class="meta">Tel: ${store.phone}</div>`);

  const infoLines = [];
  infoLines.push(`<div class="meta"><strong>N&ordm;:</strong> ${sale?.sale_number || '&mdash;'}</div>`);
  if (cfg.show_date) infoLines.push(`<div class="meta"><strong>Data:</strong> ${date}</div>`);
  if (cfg.show_seller && sale?.seller_name) infoLines.push(`<div class="meta"><strong>Vendedor:</strong> ${sale.seller_name}</div>`);
  if (cfg.show_customer && sale?.customer_name) infoLines.push(`<div class="meta"><strong>Cliente:</strong> ${sale.customer_name}</div>`);
  if (cfg.show_payment && sale?.payment_method) infoLines.push(`<div class="meta"><strong>Pagamento:</strong> ${sale.payment_method}</div>`);

  const totals = `
    <div class="row"><span>Subtotal</span><span>${money(sale?.subtotal)}</span></div>
    ${(sale?.discount || 0) > 0 ? `<div class="row"><span>Desconto</span><span>- ${money(sale?.discount)}</span></div>` : ''}
    <div class="total"><span>TOTAL</span><span>${money(sale?.total)}</span></div>
  `;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Cupom - ${sale?.sale_number || ''}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Courier New', monospace; background:#fff; color:#111; padding:14px; max-width:${w * 4}px; margin:0 auto; }
.brand { font-size:18px; font-weight:700; text-align:center; letter-spacing:0.04em; text-transform:uppercase; }
.ctitle { font-size:13px; text-align:center; font-weight:700; letter-spacing:0.12em; margin-top:4px; border-top:1px solid #111; border-bottom:1px solid #111; padding:3px 0; }
.meta { font-size:11px; text-align:center; color:#333; line-height:1.4; }
.info { margin-top:8px; border-top:1px dashed #999; border-bottom:1px dashed #999; padding:6px 0; }
.info .meta { text-align:left; }
table { width:100%; border-collapse:collapse; margin-top:6px; }
th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#666; padding-bottom:4px; }
.row { display:flex; justify-content:space-between; font-size:12px; padding:2px 0; }
.total { display:flex; justify-content:space-between; font-size:15px; font-weight:700; border-top:2px solid #111; margin-top:6px; padding-top:6px; }
.footer { text-align:center; margin-top:14px; padding-top:10px; border-top:1px dashed #999; font-size:10px; color:#555; }
@media print { body { padding:6px; } .no-print { display:none; } }
</style>
</head>
<body>
  ${headerLines.join('')}
  <div class="info">${infoLines.join('')}</div>
  ${cfg.show_items ? `<table><thead><tr><th>Produto</th><th style="text-align:center;">Qtd</th><th style="text-align:right;">Total</th></tr></thead><tbody>${itemsRows}</tbody></table>` : ''}
  <div style="margin-top:6px;">${totals}</div>
  ${cfg.footer ? `<div class="footer">${cfg.footer}</div>` : ''}
</body>
</html>`;

  const win = window.open('', '_blank', `width=${Math.max(340, w * 4)},height=800`);
  if (!win) { alert('Habilite pop-ups para imprimir o cupom.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch (e) {} }, 400);
}

export default function PrintCupomButton({ sale, store, variant, className, label, ...props }) {
  return (
    <Button variant={variant || 'outline'} size="sm" onClick={() => printControlCupom(sale, store)} className={className} {...props}>
      <Printer className="w-3.5 h-3.5" />
      {label || 'Imprimir Cupom'}
    </Button>
  );
}