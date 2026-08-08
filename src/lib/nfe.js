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

export function mapCategory(name, categoryEntities = []) {
  const n = (name || '').toLowerCase();
  // 1. Caso o nome do produto contenha o nome de uma categoria da loja (maior correspondência vence)
  const byName = categoryEntities
    .map(c => ({ name: c.name, key: (c.name || '').toLowerCase() }))
    .filter(c => c.key && n.includes(c.key))
    .sort((a, b) => b.key.length - a.key.length);
  if (byName.length) return byName[0].name;
  // 2. Regras por palavra-chave -> usa a categoria canônica só se existir na loja
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
  for (const [re, canon] of rules) if (re.test(n)) {
    const match = categoryEntities.find(c => (c.name || '').toLowerCase() === canon.toLowerCase());
    if (match) return match.name;
  }
  // 3. Fallback: categoria "Outros" da loja, primeira categoria, ou 'Outros'
  const outros = categoryEntities.find(c => (c.name || '').toLowerCase() === 'outros');
  return outros?.name || categoryEntities[0]?.name || 'Outros';
}

// Códigos numéricos das categorias (padrão de romaneio: 0–9).
// Sobrescritos pelos códigos definidos na entidade Category da loja.
export const DEFAULT_CATEGORY_CODES = {
  'Lingerie': '0', 'Blusas': '1', 'Calças': '2', 'Saias': '3',
  'Shorts': '4', 'Vestidos': '5', 'Casacos': '6', 'Moda Praia': '7', 'Acessórios': '8', 'Outros': '9',
};

export function getCategoryCode(categoryName, categoryEntities) {
  const match = (categoryEntities || []).find(c => c.name === categoryName && c.code);
  if (match?.code) return String(match.code).trim();
  return DEFAULT_CATEGORY_CODES[categoryName] || '0';
}

// Código de referência = código da categoria + preço de venda em centavos (ex.: 0 + 4,90 -> 0490).
export function buildRefCode(catCode, price) {
  const cents = Math.max(0, Math.round((Number(price) || 0) * 100));
  return `${catCode}${cents.toString().padStart(3, '0')}`;
}

/**
 * Importa as notas em uma loja-alvo: cria produtos novos ou
 * atualiza estoque dos existentes, e registra movimentações de entrada.
 */
export async function processImport(targetStoreId, notas, markup, onProgress) {
  const results = { created: 0, updated: 0, movements: 0, errors: [] };
  const total = notas.reduce((a, n) => a + n.items.length, 0);
  let done = 0;
  let categoryEntities = [];
  try { categoryEntities = await base44.entities.Category.list(); } catch { /* ignore */ }

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
            ncm: p.ncm || item.ncm || '',
          });
          results.updated++;
        } else {
          const cat = mapCategory(item.name);
          const salePrice = item.vUnCom > 0 ? Math.round(item.vUnCom * (1 + (markup || 0) / 100) * 100) / 100 : 0;
          const catCode = getCategoryCode(cat, categoryEntities);
          const refCode = buildRefCode(catCode, salePrice);
          await base44.entities.Product.create({
            store_id: targetStoreId,
            name: item.name,
            description: `NCM ${item.ncm}` + (item.sku ? ` · SKU ${item.sku}` : '') + ` · REF ${refCode}`,
            category: cat,
            price: salePrice,
            cost_price: item.vUnCom || 0,
            reference: refCode,
            sku: item.sku || '',
            ncm: item.ncm || '',
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