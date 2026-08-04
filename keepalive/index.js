/**
 * Supabase Keep-Alive Service
 * Deployed on Render.com free tier.
 * Ping /ping every 5 minutes via UptimeRobot to keep both services alive.
 */

import http from 'http';

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PORT              = process.env.PORT || 3000;
const PING_INTERVAL_MS  = 4 * 24 * 60 * 60 * 1000; // 4 days

// ── Supabase ping ──────────────────────────────────────────────────────────────

async function pingSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(`[${new Date().toISOString()}] ⚠️  Env vars not set — skipping DB ping`);
    return { ok: false, error: 'Missing env vars', ms: 0 };
  }

  const start = Date.now();
  try {
    // Use fetch directly — no SDK needed, lighter weight
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/settings?select=id&limit=1`,
      {
        headers: {
          apikey:        SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const ms = Date.now() - start;
    if (!res.ok) {
      const body = await res.text();
      console.error(`[${new Date().toISOString()}] ❌ Ping HTTP ${res.status}: ${body} (${ms}ms)`);
      return { ok: false, error: `HTTP ${res.status}`, ms };
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

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://localhost`).pathname;

  if (pathname === '/ping' || pathname === '/') {
    const result = await pingSupabase();
    res.writeHead(result.ok ? 200 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:    result.ok ? 'ok' : 'warn',
      message:   result.ok ? `Supabase alive in ${result.ms}ms` : result.error,
      timestamp: new Date().toISOString(),
      env_set:   !!(SUPABASE_URL && SUPABASE_ANON_KEY),
    }));
    return;
  }

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: Math.round(process.uptime()) }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🏃 Supabase keep-alive running on port ${PORT}`);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️  SUPABASE_URL / SUPABASE_ANON_KEY not set.');
    console.warn('   Add them in Render Dashboard → your service → Environment.');
    console.warn('   Service will still run — pings will be skipped until vars are set.');
  } else {
    console.log(`   Supabase URL: ${SUPABASE_URL}`);
    // Fire immediate ping
    pingSupabase();
    // Then every 4 days
    setInterval(pingSupabase, PING_INTERVAL_MS);
  }
});
