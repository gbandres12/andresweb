import jwt from 'jsonwebtoken';
import { db } from '../_lib/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'andresweb-secret-jwt-key-2026';

export default function handler(req, res) {
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
    const user = db.get('User', decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Usuario nao encontrado' });
    }
    const { password_hash, ...safeUser } = user;
    return res.status(200).json({ data: safeUser, ...safeUser });
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
}
