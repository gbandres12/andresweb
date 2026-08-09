import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fgfeillxojtxzdmnxanq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnZmVpbGx4b2p0eHpkbW54YW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMzYxODgsImV4cCI6MjEwMTgxMjE4OH0.6oh6R3qJk_h5trXPu7hugbNPQvu7TOZNie1XXSfVMT0';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
