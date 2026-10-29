# Kloset

AI-powered personal wardrobe and styling web app. Vite + React 18 + TypeScript SPA with an Express API, Supabase for auth/data/storage.

## Commands

```bash
npm install
npm run dev:all     # Vite (5173) + API (3001) together — use this for full functionality
npm run dev         # frontend only; /api calls fail
npm run server      # API only (node server/index.mjs)
npm run type-check  # tsc --noEmit
npm run build       # tsc && vite build (what Netlify/Vercel run)
```

Vite proxies `/api` to `localhost:3001` in dev. There are no tests; `type-check` and `build` are the checks.

## Environment

Copy `.env.example` to `.env` (gitignored — never commit it).

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — browser-side. **Required**: `src/lib/supabase.ts` throws at import if missing, so the app is blank without them. The anon key is public by design; RLS protects data.
- `GROQ_API_KEY` — vision analysis of clothing photos and primary stylist chat (server only).
- `CLAUDE_API_KEY` — chat fallback when Groq errors/rate-limits (server only).
- `EXA_API_KEY` — live shopping search (`/api/web-shop-search`) (server only).
- `PEXELS_API_KEY` — image search (`/api/search-images`); not listed in `.env.example`.

Never prefix server keys with `VITE_` — that would ship them to the browser. Hosted, these are set in the Netlify/Vercel dashboard (Vite env vars need a rebuild to change).

## Architecture

- `src/App.tsx` — router. Public: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`. Protected (`RequireAuth`): `/home`, `/onboarding`, `/wardrobe`, `/stylist`, `/discover`, `/friends`, `/profile`. Pages are lazy-loaded. `/saved` redirects to `/wardrobe?view=outfits`.
- `src/contexts/AuthContext.tsx` + `src/hooks/useDataSync.ts` — on login, load profile and wardrobe from Supabase into Zustand stores; clear on logout.
- `src/store/` — Zustand stores (user, wardrobe, outfits, chat, board), persisted to localStorage as a cache. Supabase is the source of truth.
- `src/lib/*Service.ts` — Supabase access (wardrobe, profile, friends, images). `imageStorage.ts` keeps photos in IndexedDB and mirrors them to the private `wardrobe-images` Supabase bucket.
- `src/lib/stylist.ts` — mock outfit engine with a swap-in interface for an LLM. `chatService.ts` talks to `/api/chat` ("Kaia" the stylist chat).
- `server/app.mjs` — one Express app shared by local dev (`server/index.mjs`, port 3001), Netlify (`netlify/functions/api.mjs`) and Vercel (`api/[...path].mjs`). Routes: `/api/health`, `/api/search-images`, `/api/analyze-image`, `/api/analyze-image-url`, `/api/web-shop-search`, `/api/chat`.
- `server/outfitRules.mjs` validates chat outfit suggestions (e.g. no jeans + trousers). `productPages.mjs` filters search results to real product pages.
- `supabase/` — `schema.sql`, `friends.sql`, `wardrobe_photos.sql`; run in the SQL editor in that order. All idempotent.
- `docs/exa-web-shopping-search.md` — spec for the Exa search feature.

## Shop catalog (Discover → "New pieces")

`src/lib/catalogData.ts` holds hand-written items in `RAW_CATALOG_ITEMS`, enriched at load (price, rent price, links).

- `PRODUCT_PICKS` maps item id → real retailer `image`, product `url` and `brand` (shown as a tag on the card). Items without a pick fall back to the Unsplash pools — those photos are generic.
- Items have `gender: 'women' | 'men'` (default women). `ALL_CATALOG_ITEMS` is everything; `CATALOG_ITEMS` is **women's only** and is what outfit builders, chat and "Complete the look" use; `MEN_CATALOG_ITEMS` is men's. Discover has a Women/Men toggle over `ALL_CATALOG_ITEMS`.
- Product photos are hotlinked from retailer CDNs and can break; `ShopItemCard` shows a "Photo unavailable" placeholder on error or for logo-like images (tiny / very wide). Cards set `referrerPolicy="no-referrer"`.
- To add items: add the raw entry, then find a real product via Exa (`/search`, `includeDomains` for the retailers), verify the image URL returns an image over ~15KB, and add it to `PRODUCT_PICKS`. Don't trust a 200 alone — one Westside "image" was the store logo.

## Conventions

- Path alias `@/` → `src/`. Tailwind for styling; match the existing cream/butter-yellow/dark-purple palette and the existing UI primitives in `src/components/ui/`.
- Prices are INR (₹). Rent is per week.
- Keep server secrets out of `src/`. Log prefixes like `[shop]`, `[webShopService]` are used for console debugging.
