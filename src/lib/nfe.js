import { base44 } from '@/api/base44Client';

export const NFE_CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];

/**
 * Faz o parse de um XML de Nota Fiscal Eletrônica (NFe) e extrai
 * notas -> itens de produto com qty/preço/cor/tamanho.
 */
export function parseNFeXml(txt) {
  const clean = txt.replace(/<\?xml[^>]*\?>/, '').replace(/xmlns="[^"]*"/g, '');
  const doc = new DOMParser().parseFromString(clean, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  const infNodes = Array.from(doc.querySelectorAll('infNFe'));
  if (!infNodes.length) return [];

  return infNodes.map(inf => {
    const get = (parent, tag) => {
      const el = parent?.querySelector(tag);
      return el ? el.textContent.trim() : '';
    };
    const ide = inf.querySelector('ide');
    const emit = inf.querySelector('emit');
    const dets = Array.from(inf.querySelectorAll('det'));

    const items = dets.map(det => {
      const prod = det.querySelector('prod');
      const infAd = get(det, 'infAdProd');
      const cor = (infAd.match(/cor[:\s]+([^,;\n]+)/i)?.[1] || '').trim();
      const tam = (infAd.match(/tam(?:anho)?[:\s]+([^,;\n]+)/i)?.[1] || '').trim();
      return {
        name: get(prod, 'xProd'),
        sku: get(prod, 'cProd'),
        ncm: get(prod, 'NCM'),
        uCom: get(prod, 'uCom'),
        qCom: parseFloat(get(prod, 'qCom')) || 0,
        vUnCom: parseFloat(get(prod, 'vUnCom')) || 0,
        vProd: parseFloat(get(prod, 'vProd')) || 0,
        color: cor || 'Único',
        size: (tam || 'M').slice(0, 4),
      };
    }).filter(i => i.name);

    return {
      nNF: get(ide, 'nNF'),
      serie: get(ide, 'serie'),
      dhEmi: get(ide, 'dhEmi') || get(ide, 'dEmi'),
      supplier: get(emit, 'xNome'),
      cnpj: get(emit, 'CNPJ'),
      items,
    };
  }).filter(n => n.items.length);
}

export function mapCategory(name) {
  const n = (name || '').toLowerCase();
  const rules = [
    [/vestid|macacão|macaquinho/, 'Vestidos'],
    [/blus|camis|regata|cropped/, 'Blusas'],
    [/calç|pantalon/, 'Calças'],
    [/saia/, 'Saias'],
    [/short|bermuda/, 'Shorts'],
    [/casac|jaquet|blazer|cardig|coat|sobretudo/, 'Casacos'],
    [/biquini|maiô|praia/, 'Moda Praia'],
    [/sutiã|calcinha|lingerie|body|pijam/, 'Lingerie'],
    [/bolsa|cinto|óculos|oculos|acessório|acessorio|lenço|lenco|colar|brinco|ane/, 'Acessórios'],
  ];
  for (const [re, cat] of rules) if (re.test(n)) return cat;
  return 'Outros';
}

/**
 * Importa as notas em uma loja-alvo: cria produtos novos ou
 * atualiza estoque dos existentes, e registra movimentações de entrada.
 */
export async function processImport(targetStoreId, notas, markup, onProgress) {
  const results = { created: 0, updated: 0, movements: 0, errors: [] };
  const total = notas.reduce((a, n) => a + n.items.length, 0);
  let done = 0;

  for (const nota of notas) {
    for (const item of nota.items) {
      try {
        const existing = await base44.entities.Product.filter({ store_id: targetStoreId, name: item.name });
        if (existing.length) {
          const p = existing[0];
          const variants = [...(p.variants || [])];
          const idx = variants.findIndex(v => v.size === item.size && v.color === item.color);
          if (idx >= 0) {
            variants[idx] = { ...variants[idx], stock: (variants[idx].stock || 0) + item.qCom };
          } else {
            variants.push({ size: item.size, color: item.color, stock: item.qCom, sku: item.sku });
          }
          await base44.entities.Product.update(p.id, {
            variants,
            cost_price: item.vUnCom || p.cost_price,
          });
          results.updated++;
        } else {
          await base44.entities.Product.create({
            store_id: targetStoreId,
            name: item.name,
            description: `NCM ${item.ncm}` + (item.sku ? ` · SKU ${item.sku}` : ''),
            category: mapCategory(item.name),
            price: item.vUnCom > 0 ? Math.round(item.vUnCom * (1 + (markup || 0) / 100) * 100) / 100 : 0,
            cost_price: item.vUnCom || 0,
            variants: [{ size: item.size, color: item.color, stock: item.qCom, sku: item.sku }],
            is_active: true,
            tags: [],
          });
          results.created++;
        }
        await base44.entities.StockMovement.create({
          store_id: targetStoreId,
          product_name: item.name,
          variant_size: item.size,
          variant_color: item.color,
          type: 'entrada',
          quantity: item.qCom,
          reason: `Importação NFe ${nota.nNF}${nota.serie ? '/' + nota.serie : ''}${nota.supplier ? ' - ' + nota.supplier : ''}`,
        });
        results.movements++;
      } catch (e) {
        results.errors.push(`${item.name}: ${e.message || ''}`);
      }
      done++;
      onProgress?.(done, total);
    }
  }
  return results;
}