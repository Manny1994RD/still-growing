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
- **Clean monochrome design** with automatic light and dark mode.

Planned next (see [docs/Product_Plan.pdf](docs/Product_Plan.pdf)): Friends Circle (send prayers and encouragement), prayer requests, weekly review, Spanish.

## Project layout

```
api/                 Node + TypeScript API (Hono), PostgreSQL
  migrations/        SQL schema (applied automatically on start)
  src/stats.ts       grace streaks, faithfulness, seasons (unit-tested)
  src/content.ts     encouragement library + verses (WEB)
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
- API: http://localhost:4000 (health check: `/health`)
- Data is kept in the `db-data` Docker volume.

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

1. Deploy the API somewhere public (any VPS with Docker works), then set `EXPO_PUBLIC_API_URL` in `app/eas.json` to its HTTPS URL.
2. Run:

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview      # installable .apk
npx eas-cli@latest build --platform android --profile production   # .aab for Google Play
npx eas-cli@latest build --platform ios --profile production       # .ipa for TestFlight / App Store
```

The iPhone build needs an Apple Developer account ($99/year). Google Play needs a one-time $25 developer account.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | `.env` | Database password |
| `JWT_SECRET` | `.env` | Secret for login tokens (32+ characters) |
| `PUBLIC_API_URL` | `.env` | API URL baked into the Docker web build |
| `CORS_ORIGIN` | `.env` | Allowed browser origins (`*` by default) |
| `EXPO_PUBLIC_API_URL` | `app/eas.json` or shell | API URL for phone builds |

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
