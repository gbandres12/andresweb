import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

// Public Settings shim (compatibilidade com AuthContext)
router.get('/apps/public/prod/public-settings/by-id/:appId', (req, res) => {
  res.json({
    id: req.params.appId,
    public_settings: {
      auth_required: true,
      app_name: 'AndresWeb'
    }
  });
});

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const users = db.filter('User', { email: email.toLowerCase().trim() });
    const user = users[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user', store_id: user.store_id || null },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, store_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const existing = db.filter('User', { email: email.toLowerCase().trim() });
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Cria o usuário primeiro
    const userId = db.generateId();
    const storeId = db.generateId();

    // Cria a loja inicial
    const store = db.create('Store', {
      id: storeId,
      name: store_name || `Loja de ${full_name || email.split('@')[0]}`,
      created_by_id: userId,
      settings: {
        tables: [{ id: 'cliente_final', name: 'Cliente Final', margin: 0 }],
        payment_methods: ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito']
      }
    });

    const user = db.create('User', {
      id: userId,
      email: email.toLowerCase().trim(),
      full_name: full_name || email.split('@')[0],
      password_hash,
      role: 'admin',
      store_id: store.id
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password_hash: _, ...safeUser } = user;
    res.json({ token, user: safeUser, store });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Me (autenticado)
router.get('/auth/me', authMiddleware, (req, res) => {
  const { password_hash, ...safeUser } = req.user;
  res.json({ data: safeUser, ...safeUser });
});

// Update Me
router.put('/auth/update-me', authMiddleware, (req, res) => {
  try {
    const updated = db.update('User', req.user.id, req.body);
    const { password_hash, ...safeUser } = updated;
    res.json({ data: safeUser, ...safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
