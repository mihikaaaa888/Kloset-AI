# Kloset

An AI-powered personal wardrobe and styling app for web, iOS, and Android.

## Features

- **Digital wardrobe** — add, edit and filter clothing; upload a photo and AI fills in category, colour, material, fit, seasons and occasions.
- **AI stylist** — outfit requests by occasion, weather and mood, plus "Kaia", a chat stylist that knows your wardrobe and style profile.
- **Discover** — shop real pieces from Zara, H&M, Myntra and others, with Women/Men sections, budget filters, "complete a piece" and rentals. Each photo carries a retailer tag and links to the product page.
- **Saved outfits**, **friends and sharing**, and a 9-step **onboarding** that builds your style profile.

## Tech Stack

- **Vite** + **React 18** + **TypeScript**, **Tailwind CSS**, **React Router v6**, **Zustand**, **Lucide React**
- **Express** API (`server/`), deployed as a serverless function on Netlify or Vercel
- **Supabase** — auth, Postgres (row-level security) and photo storage
- **Groq** (photo analysis, chat), **Claude** (chat fallback), **Exa** (live shopping search), **Pexels** (image search), **PhotoRoom** (garment cutouts), **Resend** (account emails)

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or later (required by Capacitor 8)
- A [Supabase](https://supabase.com) project

## Getting Started

```bash
npm install
cp .env.example .env     # then fill in your keys (see below)
npm run dev:all          # frontend on :5173, API on :3001
```

Open **http://localhost:5173**. `npm run dev` starts the frontend only; AI and shopping features need the API.

### Supabase setup

In the Supabase SQL editor, run these in order (all are safe to re-run):

1. `supabase/schema.sql`
2. `supabase/friends.sql`
3. `supabase/wardrobe_photos.sql`
4. `supabase/profile_photo.sql`, `supabase/vision_analysis_fields.sql`
5. `supabase/inactive_accounts.sql` (only for the inactive-account job)
6. `supabase/security_hardening.sql` — tighter update policies and storage size/type limits

Put your project URL and anon key in `.env`. In Supabase → Authentication → URL Configuration, set the Site URL to your production address and add `/reset-password` for production and `http://localhost:5173` to the Redirect URLs, or password-reset links won't land on the reset page.

### Environment variables

| Variable | Needed for |
|----------|-----------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | **Required.** Auth and data. The app is blank without them. |
| `GROQ_API_KEY` | Photo auto-tagging and stylist chat |
| `CLAUDE_API_KEY` | Chat fallback if Groq fails |
| `EXA_API_KEY` | Live shopping search |
| `PEXELS_API_KEY` | Image search when adding items |
| `PHOTOROOM_API_KEY` | Optional garment cutout refinement |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: account deletion and the inactive-account job |
| `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` | Daily inactive-account job (without them it refuses to run) |

Server keys must not have a `VITE_` prefix — they stay on the server. `.env` is gitignored.

## Commands

```bash
npm run dev:all    # frontend + API
npm run build      # type-check and production build
npm run preview    # preview the production build
npm run type-check # TypeScript only
node --test server/accounts.test.mjs   # the server tests
```

## Mobile App (iOS and Android)

Kloset packages the existing React app with Capacitor. Install the native
platform toolchains with Xcode (iOS) and Android Studio (Android), then set
`VITE_API_BASE_URL` in `.env` to the deployed Kloset site origin before syncing
or building a native app. Web builds keep using the same-origin `/api` routes.

```bash
npm run mobile:sync   # build the web bundle and sync both native projects
npm run mobile:ios    # build, sync, and open the iOS project
npm run mobile:android # build, sync, and open the Android project
```

Native email confirmation and password reset links need a registered mobile
deep-link scheme in Supabase before those flows are ready for release.

## Security

- **API access:** every route that spends third-party credits (chat, photo analysis, shopping and image search, cutouts) requires a signed-in user; the client sends the Supabase token via `apiFetch` (`src/lib/apiUrl.ts`) and the server verifies it. `/api` is also rate-limited per IP.
- **Server-side fetches:** `/api/analyze-image-url` refuses private and internal addresses (SSRF guard).
- **Headers:** `vercel.json` and `netlify.toml` set a Content-Security-Policy, HSTS and other security headers. If a new external host is blocked in the browser console, add it to both files.
- **Database:** row-level security on every table; the private storage buckets only allow the owner's folder, and are limited to 5 MB JPEG/PNG/WebP.
- **Secrets:** `.env` is gitignored and CI scans history for leaked keys. Never prefix a server key with `VITE_`.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to `main`: the server tests, a syntax check of `server/app.mjs`, `npm run build` (type-check plus production build), a Gitleaks secret scan, and `npm audit` for high-severity issues in production dependencies. To make it block bad merges, turn on branch protection for `main` in GitHub (Settings → Branches) and require the `check` and `secrets` jobs.

## SEO

`public/robots.txt` and `public/sitemap.xml` are served from the site root. They use `https://trykloset.com`; change the domain in both if it moves. The sitemap lists only the public pages; signed-in pages are disallowed in `robots.txt`.

## Project Structure

```
src/
  pages/        # Route-level pages (wardrobe, stylist, discover, friends, onboarding, auth)
  components/   # UI primitives, wardrobe, stylist, shop, saved, friends, layout
  store/        # Zustand stores (localStorage-cached)
  lib/          # Services (Supabase, chat, shopping), stylist engine, shop catalog
  contexts/     # Auth context
  hooks/        # Data sync, image hooks
server/         # Express API shared by local dev, Netlify and Vercel
api/, netlify/  # Serverless entry points that wrap server/app.mjs
scripts/        # eval.mjs: score photo analysis against a labelled image folder
.github/        # CI workflow
supabase/       # SQL: schema, friends, storage, account jobs, security hardening
public/         # Static files: favicon, fonts, images, robots.txt, sitemap.xml
docs/           # Feature specs
```

## Shop catalog

`src/lib/catalogData.ts` defines the Discover items. Real retailer photos and product links live in `PRODUCT_PICKS`; items without one fall back to generic stock photos. Photos are hotlinked, so a card shows a "Photo unavailable" placeholder if a retailer image stops loading. See `CLAUDE.md` for how to add items.

## Deployment

Hosted on Netlify or Vercel via GitHub: pushing builds with `npm run build` and serves `dist/`, routing `/api/*` to the Express function (`netlify.toml`). `vercel.json` and `api/` support Vercel too (including the daily inactive-account cron). Set the environment variables above in the host's dashboard; `VITE_*` values need a rebuild to change.
