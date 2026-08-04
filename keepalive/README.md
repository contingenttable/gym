# Supabase Keep-Alive Service

Prevents the Supabase free-tier project from pausing by pinging it regularly.

## The problem

Supabase free-tier projects pause after **7 days of inactivity**. The first query
after a pause takes 10–25 seconds to wake the DB, causing visible slowness.

## The solution

This tiny Node.js service runs on **Render.com free tier** and pings the Supabase
`settings` table every 4 days, keeping the project active indefinitely.

**Even better:** use [UptimeRobot](https://uptimerobot.com) (free) to call the
`/ping` endpoint every 5 minutes — that keeps both this Render service AND
Supabase alive at zero cost.

---

## Deploy to Render

### Step 1 — Create a Render Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo (`contingenttable/gym`)
3. Set:
   - **Root Directory**: `keepalive`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Step 2 — Set environment variables

In Render dashboard → your service → **Environment**:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | `your_anon_key` |

### Step 3 (optional but recommended) — UptimeRobot monitor

1. Go to [uptimerobot.com](https://uptimerobot.com) → **Add New Monitor**
2. Type: **HTTP(s)**
3. URL: `https://your-render-service.onrender.com/ping`
4. Interval: **5 minutes**

This pings every 5 minutes → keeps the Render service from spinning down AND
keeps Supabase alive. **Completely free.**

---

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Same as `/ping` |
| `GET /ping` | Pings Supabase and returns status + response time |
| `GET /health` | Returns service uptime (no DB call) |

## Example response

```json
{
  "status": "ok",
  "message": "Supabase alive in 142ms",
  "timestamp": "2026-08-05T10:30:00.000Z"
}
```
