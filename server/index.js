import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import functionRoutes from './routes/functions.js';
import uploadRoutes from './routes/uploads.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Registrar rotas
app.use('/api', authRoutes);
app.use('/api', entityRoutes);
app.use('/api', functionRoutes);
app.use(uploadRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'AndresWeb Self-Hosted Engine', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor AndresWeb rodando na porta ${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
});
