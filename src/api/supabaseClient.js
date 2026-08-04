import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example to .env.local and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    // Automatically refresh the JWT before it expires — prevents silent
    // query failures after the user has had the tab open for a long time.
    autoRefreshToken:    true,
    persistSession:      true,
    detectSessionInUrl:  true,
  },
});

export default supabase;
