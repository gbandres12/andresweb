import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'andresweb-secret-jwt-key-2026';

export function authMiddleware(req, res, next) {
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
    // Busca dados atualizados do usuário no banco
    const user = db.get('User', decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
