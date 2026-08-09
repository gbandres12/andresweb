export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { store_id } = req.body || {};

  return res.status(200).json({
    success: true,
    message: `Loja ${store_id || ''} provisionada com sucesso`,
    timestamp: new Date().toISOString()
  });
}
