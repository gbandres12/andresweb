import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../_lib/database.js';
import { supabase } from '../_lib/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'andresweb-secret-jwt-key-2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, full_name, store_name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios' });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // 1. Verifica se ja existe no Supabase
    const { data: existingSupabase } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingSupabase) {
      return res.status(400).json({ error: 'Este e-mail ja esta cadastrado no Supabase' });
    }

    const password_hash = bcrypt.hashSync(String(password), 10);
    const userId = db.generateId();
    const storeId = db.generateId();
    const orgId = db.generateId();

    const userName = full_name || cleanEmail.split('@')[0];
    const storeTitle = store_name || `Loja de ${userName}`;

    // 2. Insere Organizacao no Supabase
    await supabase.from('organizations').insert({
      id: orgId,
      name: `Org - ${storeTitle}`
    }).catch(() => {});

    // 3. Insere Loja no Supabase
    await supabase.from('stores').insert({
      id: storeId,
      organization_id: orgId,
      name: storeTitle
    }).catch(() => {});

    // 4. Insere Usuario na tabela public.users no Supabase
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      organization_id: orgId,
      store_id: storeId,
      email: cleanEmail,
      full_name: userName,
      role: 'org_admin',
      password_hash
    });

    if (userError) {
      console.warn('Aviso ao salvar no Supabase (usando fallback db.json):', userError.message);
    }

    // 5. Salva tambem no DB local
    const store = db.create('Store', {
      id: storeId,
      organization_id: orgId,
      name: storeTitle,
      created_by_id: userId
    });

    const user = db.create('User', {
      id: userId,
      organization_id: orgId,
      store_id: storeId,
      email: cleanEmail,
      full_name: userName,
      password_hash,
      role: 'org_admin',
      store_role: 'org_admin'
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, store_id: user.store_id, organization_id: orgId },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash: _, ...safeUser } = user;
    return res.status(200).json({ token, user: safeUser, store, supabase_synced: !userError });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar usuario', details: err.message });
  }
}
