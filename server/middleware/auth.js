import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { supabase } from '../../api/_lib/supabase.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'andresweb-secret-jwt-key-2026';

export async function authMiddleware(req, res, next) {
  // Permite requisições OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  let token = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 1. Busca no Supabase primeiro
    let user = null;
    try {
      const { data } = await supabase.from('users').select('*').eq('id', decoded.id).maybeSingle();
      user = data;
    } catch (e) {
      console.warn('Erro ao consultar Supabase no middleware local:', e.message);
    }

    // 2. Busca no banco local como fallback
    if (!user) {
      user = db.get('User', decoded.id);
    }

    // 3. Fallback inteligente usando os dados do próprio token
    if (!user && decoded && decoded.id) {
      user = {
        id: decoded.id,
        email: decoded.email,
        full_name: decoded.email ? decoded.email.split('@')[0] : 'Usuário',
        role: decoded.role || 'vendedor',
        store_role: decoded.role || 'vendedor',
        store_id: decoded.store_id || null,
        organization_id: decoded.organization_id || null
      };
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
