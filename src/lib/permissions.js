// Controle de Acesso por Papel (RBAC Hierárquico)
// 1. superadmin    -> Super Admin do SaaS (Você - Controle total da plataforma)
// 2. org_admin     -> Dono da Empresa / Grupo (Gestão de todas as filiais e gerentes)
// 3. store_manager -> Gerente da Loja (Operacional + Financeiro + Estoque da loja)
// 4. vendedor      -> Vendedor / Atendente (PDV, Caixa Rápido, Clientes, Vendas, Trocas)

export const ROLES = [
  { key: 'superadmin', label: 'Super Admin SaaS', tone: 'emerald' },
  { key: 'org_admin', label: 'Dono da Empresa', tone: 'primary' },
  { key: 'store_manager', label: 'Gerente da Loja', tone: 'indigo' },
  { key: 'vendedor', label: 'Vendedor', tone: 'slate' },
];

const ACCESS_BY_ROLE = {
  superadmin: null, // Acesso Irrestrito Total
  org_admin: null,  // Acesso Total ao grupo/filiais da empresa
  store_manager: [
    '/', '/pdv', '/caixa-rapido', '/produtos', '/estoque', '/estoque/entrada',
    '/importar-nfe', '/entrada-inteligente', '/transferencias', '/pesquisa-global',
    '/vendas', '/trocas', '/consignacoes', '/clientes', '/financeiro',
    '/relatorios', '/calculadora', '/funcionarios'
  ],
  vendedor: [
    '/pdv', '/caixa-rapido', '/vendas', '/trocas', '/consignacoes', '/clientes', '/produtos'
  ]
};

export function roleLabel(key) {
  return ROLES.find(r => r.key === key)?.label || key;
}

export function getRole(user) {
  if (!user) return 'vendedor';
  const role = user.role || user.store_role || 'vendedor';
  if (role === 'admin' || role === 'owner') return 'org_admin';
  return role;
}

export function canAccess(path, user) {
  const r = getRole(user);
  if (r === 'superadmin' || r === 'org_admin') return true;
  const list = ACCESS_BY_ROLE[r] || ACCESS_BY_ROLE.vendedor;
  return list.includes(path);
}

export function homeForRole(user) {
  const r = getRole(user);
  if (r === 'vendedor') return '/pdv';
  if (r === 'superadmin') return '/';
  return '/';
}

export function isSuperAdmin(user) {
  return getRole(user) === 'superadmin';
}

export function isOrgAdmin(user) {
  const r = getRole(user);
  return r === 'superadmin' || r === 'org_admin';
}

export function isManager(user) {
  const r = getRole(user);
  return r === 'superadmin' || r === 'org_admin' || r === 'store_manager';
}