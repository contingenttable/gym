import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: true,
    // Stable storage key prevents session conflicts across tabs
    storageKey: 'gym-app-auth',
  },
  realtime: {
    // Reconnect realtime channels when network recovers or tab becomes visible
    params: {
      eventsPerSecond: 10,
    },
    reconnectAfterMs: (tries) => Math.min(tries * 1000, 10000), // 1s, 2s, ... max 10s
  },
  global: {
    headers: {
      'x-app-name': 'gym-management',
    },
  },
});

export default supabase;
