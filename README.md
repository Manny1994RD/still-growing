# Still Growing

**Become who God made you to be, one faithful step at a time.**

Still Growing is a faith-based habit app. It tracks habits across every area of life (faith, health, fitness, freedom from what holds you back, relationships and more) and encourages you every day with warm, scripture-based words. Missing a day brings grace, not guilt.

One codebase ships to **Android (APK/AAB)**, **iPhone (IPA)** and the **web**. All data is stored in **PostgreSQL**, running in **Docker**.

<p align="center"><img src="app/assets/icon.png" width="96" alt="Still Growing icon" /></p>

## Features (v0.1)

- **Fresh Start onboarding:** your name, an identity statement ("In Christ, I'm becoming someone who…"), up to 3 areas to grow in, and starter habits.
- **11 areas of life:** Faith, Church & Community, Outreach & Service, Health & Nutrition, Fitness & Movement, Rest & Self-care, Freedom (private by default), Mind & Growth, Family & Relationships, Stewardship, plus your own custom areas.
- **5 habit types:** *Do it* (yes/no), *Count it* (8 glasses of water), *Time it* (20 min of Bible reading), *Weekly* (church 2× a week), *Stay free* (no soda, counts days free).
- **Grace streaks:** one missed day per week is covered automatically. Rest days keep your streak. A slip on a "stay free" habit gets compassion, not shame.
- **Encouragement:** a verse of the day, a warm word after every goal, and milestone messages (3, 7, 21, 40, 100 days). Scripture comes from the public-domain World English Bible.
- **Local reminders** on Android and iPhone: a morning word, habit reminders and an evening check-in, scheduled on the device with a different message each day.
- **Growth:** faithfulness %, streaks, Growth Seasons (Seed → Sprout → Rooted → Fruitful → Overflowing), a 5-week calendar and whole-life balance by area.
- **Evening reflection:** three private prompts to end the day with God.
- **Share your growth** without revealing habit names. Freedom habits are never shared.
- **Friends Circle** (optional, off by default): add friends by code, see each other's growth (season, streak, faithfulness, areas), send a prayer in one tap, blessings, verses and short notes, and share prayer requests. Habit names, reflections and Freedom habits are never shown. Includes a message filter, block, report, a "blessings only" setting and a gentle "could use encouragement" nudge that users opt into.
- **Self-hosting friendly:** the server address can be changed inside the app, so one Android/iPhone build works with your own server.
- **English and Spanish:** each person picks their language (it follows the phone by default). Messages, verses (WEB / Reina-Valera 1909), blessings and notifications all switch, and blessings from friends show in the reader's language.
- **Clean monochrome design** with automatic light and dark mode.

Planned next (see [docs/Product_Plan.pdf](docs/Product_Plan.pdf)): push notifications for prayers received, weekly review.

## Project layout

```
api/                 Node + TypeScript API (Hono), PostgreSQL
  migrations/        SQL schema (applied automatically on start)
  src/stats.ts       grace streaks, faithfulness, seasons (unit-tested)
  src/content.ts     encouragement library, blessings + verses (WEB)
  src/circle.ts      Friends Circle routes
app/                 Expo (React Native) app for Android, iOS and web
  src/app/           screens (Expo Router)
  src/ui/            design system (monochrome tokens, components)
  src/lib/           API client, auth, notifications, suggestions
docker-compose.yml   Postgres + API + web (nginx)
docs/                product plan
```

## Run everything with Docker

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env      # then edit the passwords/secrets
docker compose up -d --build
```

- Web app: http://localhost:8080
- API: http://localhost:8080/api (also on port 4000; health check: `/health`)
- Data is kept in the `db-data` Docker volume.

## Hosting on your own home server

The phones and the web app never talk to the database directly. They call the **API**, and the API reads and writes Postgres on your server:

```
iPhone / Android / browser  ──HTTPS──▶  your server: web (nginx) ──/api──▶ API ──▶ Postgres
```

Run `docker compose up -d --build` on the server, then choose how phones reach it:

| Option | Works from | Setup | Notes |
|---|---|---|---|
| **A. Home Wi-Fi only** | Your home network | None. Use `http://<server-ip>:8080/api` | Simplest. Doesn't work on cellular or away from home. |
| **B. Cloudflare Tunnel** (recommended) | Anywhere | Free Cloudflare account + a domain (~$10/yr) | Real HTTPS, no router ports opened, home IP stays hidden. |
| **C. Tailscale Funnel** | Anywhere | Free Tailscale account, no domain needed | `tailscale funnel --bg 8080` publishes it at `https://<machine>.<tailnet>.ts.net`. Keep the machine and tailnet names fixed after building the apps. |

**Option B, step by step:**
1. In the Cloudflare dashboard go to Zero Trust → Networks → Tunnels → Create a tunnel, and copy its token.
2. Add a public hostname (for example `growing.yourdomain.com`) pointing to `http://web:80`.
3. Put the token in `.env` as `CLOUDFLARE_TUNNEL_TOKEN=...`
4. Run `docker compose --profile tunnel up -d`
5. In the app, tap **Server · Change** on the sign-in screen and enter `https://growing.yourdomain.com/api`, or bake it into the builds (see below).

Back up your data with:

```bash
docker compose exec db pg_dump -U still_growing still_growing > backup.sql
```

## Develop locally (no Docker needed)

The API falls back to an embedded Postgres (PGlite) stored in `api/.data/` when `DATABASE_URL` isn't set.

```bash
cd api && npm install && npm run dev        # http://localhost:4000
cd app && npm install && npx expo start      # press w for web, or scan the QR with Expo Go
```

On a phone with Expo Go, the app automatically talks to the API on the computer running Expo (port 4000). Your phone and computer need to be on the same Wi-Fi.

Tests:

```bash
cd api && npm test
cd app && npx tsc --noEmit
```

## Build the Android and iPhone apps

Builds run in the cloud with Expo Application Services (EAS), so **no Mac is needed for the iPhone build**.

The server address is baked into the apps at build time. It's kept in your Expo account (not in this public repo), so your home server's address isn't published on GitHub.

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest init                       # links the project to your Expo account (first time only)

# Store your server address once per build profile:
npx eas-cli@latest env:create --environment preview    --name EXPO_PUBLIC_API_URL --value https://<your-server>/api --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<your-server>/api --visibility plaintext

npx eas-cli@latest build --platform android --profile preview      # installable .apk to share directly
npx eas-cli@latest build --platform android --profile production   # .aab for Google Play
npx eas-cli@latest build --platform ios --profile production       # .ipa for TestFlight / App Store
```

The iPhone build needs an Apple Developer account ($99/year). Google Play needs a one-time $25 developer account. People can still change the server inside the app (**Server · Change** on the sign-in screen).

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | `.env` | Database password |
| `JWT_SECRET` | `.env` | Secret for login tokens (32+ characters) |
| `PUBLIC_API_URL` | `.env` | API URL baked into the Docker web build (`/api` by default) |
| `CLOUDFLARE_TUNNEL_TOKEN` | `.env` | Optional tunnel for access from anywhere |
| `CORS_ORIGIN` | `.env` | Allowed browser origins (`*` by default) |
| `EXPO_PUBLIC_API_URL` | EAS environment variable | API URL baked into phone builds |

## API overview

All routes except `/health` and `/auth/*` need `Authorization: Bearer <token>`.

| Method | Route | |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Create account / sign in |
| GET, PATCH, DELETE | `/me` | Profile, settings, delete account |
| GET, POST, DELETE | `/categories` | Built-in and custom areas |
| GET, POST, PATCH, DELETE | `/habits` | Habits |
| GET | `/today?date=YYYY-MM-DD` | Today's habits, verse and greeting |
| PUT | `/checkins` | Log progress (returns encouragement and streak) |
| DELETE | `/checkins/:habitId/:date` | Clear a check-in |
| GET | `/stats?today=YYYY-MM-DD` | Streaks, faithfulness, season, calendar |
| GET, POST | `/reflections` | Evening reflections |
| GET | `/content` | Message library (used for local reminders) |
| GET | `/circle`, `/circle/summary` | Friends, requests, inbox, prayer requests |
| POST | `/circle/settings` | Turn the Circle on or off, privacy options |
| POST, DELETE | `/friends`, `/friends/:id`, `/friends/:id/accept`, `/friends/:id/block` | Add by code, accept, remove, block |
| POST | `/encouragements`, `/encouragements/read` | Send a prayer, blessing, verse or note |
| POST, DELETE | `/prayer-requests`, `/prayer-requests/:id/pray` | Prayer requests |
| POST | `/reports` | Report a user or message |
