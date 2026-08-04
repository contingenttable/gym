import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';

// ── Supabase DB adapter ────────────────────────────────────────────────────────
// All pages and gym.js utility functions reference `db` as a global.
// We set it on globalThis so it's available everywhere before React renders.
import { db } from '@/api/db.js';
globalThis.db = db;
// ──────────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
