import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example to .env.local and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    // Persist the session in localStorage so page refreshes don't log the user out
    persistSession: true,
    // Auto-refresh the JWT before it expires — prevents idle-timeout logouts
    autoRefreshToken: true,
    // Detect the OAuth callback from the URL hash on page load
    detectSessionInUrl: true,
  },
  realtime: {
    // Reconnect websocket faster after network/idle drops (default is 10 000 ms)
    reconnectAfterMs: (tries) => Math.min(tries * 1000, 10000),
  },
  global: {
    headers: { 'x-application-name': 'gym-management' },
  },
});

export default supabase;
