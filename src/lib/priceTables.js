// Tabelas de preço configuráveis por loja: nome + forma de pagamento + ajuste %.
export const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Cartão', 'Crédito da loja'];

export const DEFAULT_TABLES_CONFIG = [
  { key: 'cliente_final', name: 'Varejo', payment_method: 'Dinheiro', adjustment: 0 },
  { key: 'atacado', name: 'PIX', payment_method: 'PIX', adjustment: -10 },
  { key: 'revenda', name: 'DEP', payment_method: 'Cartão', adjustment: -5 },
];

// Compatibilidade com código legado que usa PRICE_TABLES / PRICE_TABLE_DEFAULTS
export const PRICE_TABLES = DEFAULT_TABLES_CONFIG.map(t => ({ key: t.key, label: t.name }));
export const PRICE_TABLE_DEFAULTS = DEFAULT_TABLES_CONFIG.reduce((a, t) => { a[t.key] = t.adjustment; return a; }, {});

// Resolve as tabelas da loja, mesclando config salva sobre os defaults.
export const getStoreTables = (store) => {
  const cfg = store?.settings?.price_tables_config;
  if (Array.isArray(cfg) && cfg.length) {
    return DEFAULT_TABLES_CONFIG.map(d => {
      const c = cfg.find(x => x.key === d.key) || {};
      return {
        key: d.key,
        name: (c.name || d.name).trim() || d.name,
        payment_method: c.payment_method || d.payment_method,
        adjustment: Number(c.adjustment ?? d.adjustment),
      };
    });
  }
  // fallback: defaults ajustados pelos price_tables_defaults legados
  const defs = store?.settings?.price_tables_defaults;
  return DEFAULT_TABLES_CONFIG.map(d => ({ ...d, adjustment: Number(defs?.[d.key] ?? d.adjustment) }));
};

// Um produto só recebe o preço da tabela se participar dela (active_tables vazio = participa de todas).
export const isTableActive = (product, tableKey) => {
  if (!product?.active_tables || product.active_tables.length === 0) return true;
  return product.active_tables.includes(tableKey);
};

export const getTablePct = (product, tableKey, tablesConfig) => {
  const override = product?.price_tables?.[tableKey];
  if (override !== undefined && override !== '' && !Number.isNaN(Number(override))) return Number(override);
  if (Array.isArray(tablesConfig)) {
    const tc = tablesConfig.find(t => t.key === tableKey);
    return tc ? Number(tc.adjustment) || 0 : 0;
  }
  return Number(PRICE_TABLE_DEFAULTS[tableKey]) || 0;
};

export const effectivePrice = (product, tableKey, tablesConfig) => {
  const base = Number(product?.price) || 0;
  if (!isTableActive(product, tableKey)) return base;
  const pct = getTablePct(product, tableKey, tablesConfig);
  return Math.round((base * (1 + pct / 100)) * 100) / 100;
};

export const fmtPct = (v) => `${v > 0 ? '+' : ''}${Number(v)}%`;