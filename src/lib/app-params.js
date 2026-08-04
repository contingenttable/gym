// app-params.js — Base44 parameter helpers (no longer used after Supabase migration)
// Kept as a stub to avoid import errors in any remaining references.

export const appParams = {
  appId: import.meta.env.VITE_SUPABASE_URL || '',
  token: null,
};

export default appParams;
