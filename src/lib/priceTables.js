// Tabelas de preço configuráveis por loja: nome + forma de pagamento + margem.
// A margem é a fonte de verdade (aplicada automaticamente em todo o sistema).
export const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Cartão', 'Crédito da loja'];

export const DEFAULT_TABLES_CONFIG = [
  { key: 'cliente_final', name: 'Varejo', payment_method: 'Dinheiro', adjustment: 0 },
  { key: 'atacado', name: 'PIX', payment_method: 'PIX', adjustment: -10 },
  { key: 'revenda', name: 'Depósito', payment_method: 'Cartão', adjustment: -5 },
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
  const defs = store?.settings?.price_tables_defaults;
  return DEFAULT_TABLES_CONFIG.map(d => ({ ...d, adjustment: Number(defs?.[d.key] ?? d.adjustment) }));
};

// Um produto só recebe o preço da tabela se participar dela (active_tables vazio = participa de todas).
export const isTableActive = (product, tableKey) => {
  if (!product?.active_tables || product.active_tables.length === 0) return true;
  return product.active_tables.includes(tableKey);
};

// A margem vem da tabela (config da loja). Não há mais ajuste por produto.
export const getTablePct = (tableKey, tablesConfig) => {
  if (Array.isArray(tablesConfig)) {
    const tc = tablesConfig.find(t => t.key === tableKey);
    if (tc) return Number(tc.adjustment) || 0;
  }
  return Number(PRICE_TABLE_DEFAULTS[tableKey]) || 0;
};

export const effectivePrice = (product, tableKey, tablesConfig) => {
  const base = Number(product?.price) || 0;
  if (!isTableActive(product, tableKey)) return base;
  const pct = getTablePct(tableKey, tablesConfig);
  return Math.round((base * (1 + pct / 100)) * 100) / 100;
};

export const fmtPct = (v) => `${v > 0 ? '+' : ''}${Number(v)}%`;

// Formas de pagamento do checkout — rótulos personalizáveis por loja.
// O "value" é o nome interno (usado no sistema); o "label" é o que o cliente vê no caixa.
export const DEFAULT_PAYMENT_METHOD_CONFIG = [
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'Cartão', label: 'Cartão' },
  { value: 'Crédito da loja', label: 'Crédito da loja' },
  { value: 'Consignação', label: 'Consignação' },
];

export const getStorePaymentMethods = (store) => {
  const cfg = store?.settings?.payment_methods;
  if (Array.isArray(cfg) && cfg.length) {
    const byVal = {};
    cfg.forEach(c => { if (c?.value) byVal[c.value] = (c.label || c.value).trim() || c.value; });
    return DEFAULT_PAYMENT_METHOD_CONFIG.map(d => ({ value: d.value, label: byVal[d.value] || d.label }));
  }
  return DEFAULT_PAYMENT_METHOD_CONFIG.map(d => ({ ...d }));
};

export const getPaymentMethodLabel = (store, value) => {
  const m = getStorePaymentMethods(store).find(x => x.value === value);
  return m?.label || value || '';
};