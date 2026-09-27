# Moodly Backend

Backend API for the Moodly mood tracking app, providing secure data storage, analytics, and automated features.

## Technologies

- TypeScript
- Vercel (serverless deployment)
- Supabase (PostgreSQL database)
- Node.js

## Features

- Session-token authentication, issued in exchange for the master password
- CRUD operations for mood entries
- Location search and weather lookup
- Email alerts, scheduled letters and email reports via cron jobs
- User settings and metric configuration

## Setup

1. `npm install`
2. Set environment variables (see `.env.example`):
   - `SUPABASE_URL` - Supabase project URL
   - `SUPABASE_KEY` - Supabase **service-role (secret) key**. RLS is enabled with no policies, so the anon key cannot read or write.
   - `MASTER_PASSWORD` - Master password, exchanged for a session token at login
   - `SESSION_SECRET` - Random secret used to sign session tokens (e.g. `openssl rand -base64 32`). Rotating it logs out every session.
   - `CRON_SECRET` - Secret Vercel sends as `Authorization: Bearer <CRON_SECRET>` on cron invocations
   - `SMTP_USER` - Gmail address used to send email
   - `SMTP_PASS` - Gmail app password
   - `GEOAPIFY_API_KEY` - API key for Geoapify location search
3. Deploy to Vercel or run locally with `vercel dev --listen 3001`

## Scripts

- `npm run typecheck` - Type-check the project
- `npm run check:types` - Verify `types/shared.ts` matches the frontend's `app/types/shared.ts` (expects the frontend repo at `../moodly-frontend`, or pass its path)

## Authentication

`POST /api/verify-password` with `{ "password": "..." }` returns `{ token, expiresAt }`. Every other endpoint expects `Authorization: Bearer <token>`. Tokens are HMAC-signed and valid for 7 days.

Cron endpoints also accept `Authorization: Bearer <CRON_SECRET>`, so they can be run manually with:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://moodly-backend.vercel.app/api/cron/send-emails
```

## API Endpoints

All endpoints are wrapped in `withApi` (`utils/api`), which handles CORS, preflight, allowed methods, auth and uncaught errors.

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/verify-password` | POST | Exchange the master password for a session token (public) |
| `/api/entries` | GET, POST, DELETE | List entries (`?from=`, `?to=`, `?date=`), save by date, delete by id |
| `/api/metric-config` | GET, POST | Read or replace the metric configuration |
| `/api/settings` | GET, POST | Read or update email settings |
| `/api/email-alerts` | GET, POST, DELETE | Manage email alerts |
| `/api/check-entry-alerts` | POST | Evaluate alerts for one date's entry and send matching emails |
| `/api/letters` | POST | Schedule a letter to your future self |
| `/api/search-location` | GET | Location autocomplete (`?q=`) |
| `/api/get-weather` | GET | Daytime weather summary (`?lat=&lon=&date=`) |

### Cron Jobs

| Endpoint | Schedule (UTC) | Purpose |
|---|---|---|
| `/api/cron/send-emails` | 19:00 daily | Due scheduled letters, daily reminder, weekly (Sunday) and monthly (last day) reports |
| `/api/cron/check-email-alerts` | 21:00 daily | Evaluate email alerts against today's entry |
