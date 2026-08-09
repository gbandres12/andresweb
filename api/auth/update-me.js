import jwt from 'jsonwebtoken';
import { db } from '../_lib/database.js';
import { supabase } from '../_lib/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'andresweb-secret-jwt-key-2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    const userId = decoded.id;
    const updateData = req.body || {};

    // Atualiza no Supabase
    try {
      await supabase.from('users').update({
        store_id: updateData.store_id || null,
        role: updateData.store_role || updateData.role || 'org_admin'
      }).eq('id', userId);
    } catch (e) {}

    // Atualiza localmente
    const updated = db.update('User', userId, updateData);
    const safeUser = updated || { id: userId, ...updateData };

    return res.status(200).json({ data: safeUser, ...safeUser });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
