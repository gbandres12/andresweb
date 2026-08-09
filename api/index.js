import app from '../server/index.js';

export default function handler(req, res) {
  try {
    // Restaura a URL original antes da reescrita do Vercel
    const forwardedUrl = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'];
    if (forwardedUrl) {
      req.url = forwardedUrl;
    }
    return app(req, res);
  } catch (err) {
    console.error('Erro na execucao da Serverless Function:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
