import { supabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();

  try {
    // Query de teste simples na tabela public.users do Supabase
    const { data, count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    const latencyMs = Date.now() - startTime;

    if (error) {
      return res.status(500).json({
        status: 'error',
        connected: false,
        error: error.message,
        hint: error.hint || 'Verifique as configuracoes de RLS e chaves no Vercel',
        latency_ms: latencyMs,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      status: 'healthy',
      connected: true,
      provider: 'Supabase PostgreSQL Cloud',
      users_count: count ?? 0,
      latency_ms: latencyMs,
      env: {
        has_supabase_url: !!process.env.VITE_SUPABASE_URL || !!process.env.SUPABASE_URL,
        has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        has_anon_key: !!process.env.VITE_SUPABASE_ANON_KEY
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: 'critical_error',
      connected: false,
      error: err.message,
      latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }
}
