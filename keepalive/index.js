/**
 * Supabase Keep-Alive Service
 *
 * Deployed on Render.com as a free web service.
 * Pings the Supabase DB every 4 days via a scheduled HTTP call
 * so the free-tier Postgres instance never pauses (Supabase pauses
 * projects after 7 days of inactivity).
 *
 * How to set up on Render:
 *  1. Create a new Web Service on render.com pointing at this directory
 *  2. Set environment variables:
 *       SUPABASE_URL      = https://your-project.supabase.co
 *       SUPABASE_ANON_KEY = your_anon_key
 *  3. Also create a Render Cron Job that hits GET /ping every 4 days
 *     (or use the built-in interval below which pings every 4 days
 *      as long as this service itself is alive).
 *
 * The /ping endpoint can also be called externally (e.g. from UptimeRobot
 * free tier, which pings every 5 minutes — this keeps both the Render
 * service AND Supabase alive at zero cost).
 */

import { createClient } from '@supabase/supabase-js';
import http from 'http';

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PORT              = process.env.PORT || 3000;

// Interval: ping DB every 4 days (well within the 7-day pause window)
const PING_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Ping function ──────────────────────────────────────────────────────────────

async function pingSupabase() {
  const start = Date.now();
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('id')
      .limit(1);

    const ms = Date.now() - start;

    if (error) {
      console.error(`[${new Date().toISOString()}] ❌ Ping failed: ${error.message} (${ms}ms)`);
      return { ok: false, error: error.message, ms };
    }

    console.log(`[${new Date().toISOString()}] ✅ Supabase alive — ${ms}ms`);
    return { ok: true, ms };
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`[${new Date().toISOString()}] ❌ Ping error: ${err.message} (${ms}ms)`);
    return { ok: false, error: err.message, ms };
  }
}

// ── HTTP server ────────────────────────────────────────────────────────────────
// Render requires a web service to bind to a port.
// Expose a /ping endpoint so external monitors (UptimeRobot etc.) can call it.

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/ping' || url.pathname === '/') {
    const result = await pingSupabase();
    res.writeHead(result.ok ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:    result.ok ? 'ok' : 'error',
      message:   result.ok ? `Supabase alive in ${result.ms}ms` : result.error,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🏃 Supabase keep-alive running on port ${PORT}`);
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Auto-ping interval: every 4 days`);

  // Fire an immediate ping on startup
  pingSupabase();

  // Then ping every 4 days
  setInterval(pingSupabase, PING_INTERVAL_MS);
});
