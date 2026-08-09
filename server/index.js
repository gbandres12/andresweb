import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import functionRoutes from './routes/functions.js';
import uploadRoutes from './routes/uploads.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Body parsing seguro para Vercel Serverless e Node local
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.json({ limit: '50mb' })(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'Invalid JSON payload' });
    next();
  });
});
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

// Registrar rotas (suporta chamadas com /api/... e diretamente /...)
app.use('/api', authRoutes);
app.use('/api', entityRoutes);
app.use('/api', functionRoutes);

app.use('/', authRoutes);
app.use('/', entityRoutes);
app.use('/', functionRoutes);
app.use(uploadRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'AndresWeb Self-Hosted Engine', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'AndresWeb Self-Hosted Engine', timestamp: new Date().toISOString() });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor AndresWeb rodando na porta ${PORT}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  });
}

export default app;
