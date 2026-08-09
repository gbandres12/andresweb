export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ 
    status: 'ok', 
    server: 'AndresWeb Serverless Engine',
    timestamp: new Date().toISOString()
  });
}
