import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../_lib/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'andresweb-secret-jwt-key-2026';

export default function handler(req, res) {
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
    const existing = db.filter('User', { email: cleanEmail });
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Este e-mail ja esta cadastrado' });
    }

    const password_hash = bcrypt.hashSync(String(password), 10);
    const userId = db.generateId();
    const storeId = db.generateId();

    const store = db.create('Store', {
      id: storeId,
      name: store_name || `Loja de ${full_name || cleanEmail.split('@')[0]}`,
      created_by_id: userId,
      settings: {
        tables: [{ id: 'cliente_final', name: 'Cliente Final', margin: 0 }],
        payment_methods: ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito']
      }
    });

    const user = db.create('User', {
      id: userId,
      email: cleanEmail,
      full_name: full_name || cleanEmail.split('@')[0],
      password_hash,
      role: 'org_admin',
      store_role: 'org_admin',
      store_id: store.id
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash: _, ...safeUser } = user;
    return res.status(200).json({ token, user: safeUser, store });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar usuario', details: err.message });
  }
}
