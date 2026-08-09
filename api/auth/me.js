import jwt from 'jsonwebtoken';
import { db } from '../_lib/database.js';
import { supabase } from '../_lib/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'andresweb-secret-jwt-key-2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  let token = null;
  if (authHeader) {
    token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // 1. Busca primeiro no Supabase
    let user = null;
    try {
      const { data: sbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .maybeSingle();

      if (sbUser) {
        user = sbUser;
      }
    } catch (e) {
      console.warn('Erro ao consultar Supabase em /me:', e.message);
    }

    // 2. Fallback para DB local
    if (!user) {
      user = db.get('User', decoded.id);
    }

    // 3. Fallback inteligente usando os dados do próprio JWT assinado
    if (!user && decoded && decoded.id) {
      user = {
        id: decoded.id,
        email: decoded.email,
        full_name: decoded.email ? decoded.email.split('@')[0] : 'Usuario',
        role: decoded.role || 'vendedor',
        store_role: decoded.role || 'vendedor',
        store_id: decoded.store_id || null
      };
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuario nao encontrado' });
    }

    const { password_hash, ...safeUser } = user;
    return res.status(200).json({ data: safeUser, ...safeUser });
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
}
