import app from '../server/index.js';

export default function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    console.error('Vercel API handler error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
      stack: err.stack
    });
  }
}
