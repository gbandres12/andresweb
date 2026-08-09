import bcrypt from 'bcryptjs';
import { db } from './db/database.js';

async function seedTestUsers() {
  console.log('🌱 Criando Usuários de Teste para os 4 Níveis de Acesso...');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('123456', salt);

  // 1. Organização e Loja Exemplo
  const orgA = db.create('Store', {
    name: 'Grupo Moda Cliente A (5 Lojas)',
    plan: 'enterprise'
  });

  const store1 = db.create('Store', {
    name: 'Loja 1 - Centro',
    organization_id: orgA.id
  });

  const store2 = db.create('Store', {
    name: 'Loja 2 - Shopping',
    organization_id: orgA.id
  });

  // 2. Criar os 4 Usuários de Teste
  const testUsers = [
    {
      email: 'superadmin@andresweb.com',
      full_name: 'Gabriel (Super Admin SaaS)',
      role: 'superadmin',
      store_role: 'superadmin',
      password_hash: passwordHash,
      store_id: null
    },
    {
      email: 'dono@clienteA.com',
      full_name: 'Carlos (Dono do Cliente A)',
      role: 'org_admin',
      store_role: 'org_admin',
      password_hash: passwordHash,
      organization_id: orgA.id,
      store_id: store1.id
    },
    {
      email: 'gerente.loja1@clienteA.com',
      full_name: 'Mariana (Gerente Loja 1)',
      role: 'store_manager',
      store_role: 'store_manager',
      password_hash: passwordHash,
      organization_id: orgA.id,
      store_id: store1.id
    },
    {
      email: 'vendedor.loja1@clienteA.com',
      full_name: 'Lucas (Vendedor Loja 1)',
      role: 'vendedor',
      store_role: 'vendedor',
      password_hash: passwordHash,
      organization_id: orgA.id,
      store_id: store1.id
    }
  ];

  for (const u of testUsers) {
    const existing = db.filter('User', { email: u.email });
    if (existing.length === 0) {
      db.create('User', u);
      console.log(`✅ Criado: ${u.email} | Nível: ${u.role}`);
    } else {
      db.update('User', existing[0].id, u);
      console.log(`🔄 Atualizado: ${u.email} | Nível: ${u.role}`);
    }
  }

  console.log('\n✨ Todos os usuários de teste foram prontamente configurados!');
  console.log('🔑 Senha padrão para todos: 123456');
}

seedTestUsers();
