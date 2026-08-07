// Tabelas de preço: base + ajuste percentual por canal de venda.
export const PRICE_TABLES = [
  { key: 'cliente_final', label: 'Cliente Final' },
  { key: 'atacado', label: 'Atacado' },
  { key: 'revenda', label: 'Revenda' },
];

export const PRICE_TABLE_DEFAULTS = {
  cliente_final: 0,
  atacado: -10,
  revenda: -5,
};

export const getTablePct = (product, tableKey) =>
  product?.price_tables?.[tableKey] ?? PRICE_TABLE_DEFAULTS[tableKey] ?? 0;

export const effectivePrice = (product, tableKey) => {
  const base = Number(product?.price) || 0;
  const pct = getTablePct(product, tableKey);
  return Math.round((base * (1 + pct / 100)) * 100) / 100;
};

export const fmtPct = (v) => `${v > 0 ? '+' : ''}${Number(v)}%`;