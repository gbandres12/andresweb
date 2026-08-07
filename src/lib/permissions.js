// Controle de acesso por papel dentro da loja (store_role)
// dono (owner / admin)  -> acesso total + gestão de funcionários
// gerente (manager)     -> acesso gerencial (operacional + financeiro/relatórios)
// vendedor (staff)       -> acesso limitado (PDV, clientes, vendas)

export const STORE_ROLES = [
  { key: 'owner', label: 'Dono', tone: 'primary' },
  { key: 'manager', label: 'Gerente', tone: 'indigo' },
  { key: 'staff', label: 'Vendedor', tone: 'slate' },
];

const ACCESS = {
  owner: null, // null = acesso total
  manager: [
    '/pdv', '/produtos', '/entrada-inteligente', '/importar-nfe', '/estoque',
    '/clientes', '/vendas', '/financeiro', '/calculadora',
    '/pesquisa-global', '/relatorios', '/transferencias',
  ],
  staff: ['/pdv', '/clientes', '/vendas'],
};

export function roleLabel(key) {
  return STORE_ROLES.find(r => r.key === key)?.label || key;
}

// Resolve o papel efetivo do usuário: admin da plataforma = dono
export function getRole(user) {
  if (!user) return 'staff';
  if (user.role === 'admin') return 'owner';
  return user?.data?.store_role || user?.store_role || 'staff';
}

export function canAccess(path, user) {
  const r = getRole(user);
  if (r === 'owner') return true;
  const list = ACCESS[r] || ACCESS.staff;
  return list.includes(path);
}

export function homeForRole(user) {
  return getRole(user) === 'staff' ? '/pdv' : '/';
}

export function isOwner(user) {
  return getRole(user) === 'owner';
}