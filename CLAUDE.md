# Kloset

AI-powered personal wardrobe and styling web app. Vite + React 18 + TypeScript SPA, an Express API in `server/`, and Supabase for auth, data and photo storage. Prices are INR (₹); rent is per week.

The git repo root is this folder (`Kloset-AI/`). Run git and npm commands from here, never from the folder above.

## Safety rules (always)

1. **Never open, print or `source` `.env`.** Key names are in `.env.example`; ask the user if you think you need a value.
2. **Never commit, push, merge or open a PR unless the user asks.** Say what changed and let them decide.
3. **Server keys never go in `src/` or get a `VITE_` prefix** (that ships them to the browser). Only the Supabase URL and anon key are public.
4. **Don't delete or overwrite data, files or branches without asking.** Look at the target first.
5. **Don't weaken security to make something work.** If a check blocks you, say why and ask (see "Security" below).
6. If the request is unclear, ask one short question instead of guessing.

## Check your work

| Command | When |
|---------|------|
| `npm run type-check` | After every code change. Fix errors you caused; report ones you didn't. |
| `npm run build` | After bigger changes (what Netlify/Vercel run). |
| `node --test server/accounts.test.mjs` | After touching `server/accounts.mjs`. |

CI (`.github/workflows/ci.yml`) runs the tests, build, a secret scan and `npm audit` on every PR. There is no linter and no browser test, so say plainly when something was not tried in a browser.

Start everything with `npm run dev:all` (site on :5173, API on :3001). `npm run dev` alone has no `/api`.

## Where things are

- `src/App.tsx`: routes. Public: `/`, `/privacy`, `/login`, `/signup`, `/forgot-password`, `/reset-password`. Signed-in only (`RequireAuth`): `/home`, `/onboarding`, `/wardrobe`, `/stylist`, `/discover`, `/friends`, `/profile`. `/saved` redirects to `/wardrobe?view=outfits`.
- `src/pages/`, `src/components/` (UI primitives in `components/ui/`): screens and pieces. Reuse an existing primitive before writing a new one.
- `src/store/`: Zustand stores, cached in localStorage. Supabase is the source of truth.
- `src/lib/`: services. `*Service.ts` talk to Supabase; `chatService.ts` talks to "Kaia" the stylist chat; `stylist.ts` is the mock outfit engine; `imageStorage.ts` keeps photos in IndexedDB and mirrors them to the private `wardrobe-images` bucket.
- `src/contexts/AuthContext.tsx` + `src/hooks/useDataSync.ts`: load data on login, clear on logout.
- `server/app.mjs`: the one Express app, used locally (`server/index.mjs`), on Netlify (`netlify/functions/api.mjs`) and on Vercel (`api/[...path].mjs`). `outfitRules.mjs` validates outfit suggestions; `productPages.mjs` keeps only real product links; `accounts.mjs` is the inactive-account job.
- `supabase/`: SQL, run in the SQL editor in this order: `schema.sql`, `friends.sql`, `wardrobe_photos.sql`, `profile_photo.sql`, `vision_analysis_fields.sql`, `inactive_accounts.sql`, `security_hardening.sql`. All safe to re-run.
- `public/`: static files, plus `robots.txt` and `sitemap.xml` (domain `https://trykloset.com`; add new public pages to the sitemap, and new signed-in pages to `robots.txt`).
- `docs/exa-web-shopping-search.md`: spec for the shop search.

## Security (built in, keep it that way)

- **API routes that spend paid credits** (chat, photo analysis, shop/image search, cutouts) need a signed-in user. Call them with `apiFetch` from `src/lib/apiUrl.ts`, never bare `fetch`. New routes of this kind must use `requireUser` in `server/app.mjs`.
- **Fetching a user-supplied URL on the server** must go through the SSRF guard (`assertPublicUrl` / `fetchPublicImage`).
- **New external site the browser must reach** (API, images, fonts, scripts): add it to the Content-Security-Policy in both `vercel.json` and `netlify.toml`, or the browser will block it.
- **Every new table needs row-level security** and policies that tie rows to `auth.uid()`; put them in a new idempotent `supabase/*.sql` file. Update policies need `with check`, not only `using`.
- Render user content as React text. No `dangerouslySetInnerHTML`, `innerHTML` or `eval`.
- Validate and cap input sizes on the server, not only in the browser.

## Conventions

- Path alias `@/` → `src/`. Tailwind for styling; match the cream / butter-yellow / dark-purple palette.
- TypeScript strict: no `any`, handle null and undefined explicitly.
- Log with prefixes like `[shop]`, `[webShopService]`; never log tokens, keys or passwords. Production builds strip `console.log`.
- Don't add a dependency for a few lines of code.

## Shop catalog (Discover → "New pieces")

`src/lib/catalogData.ts` holds hand-written items in `RAW_CATALOG_ITEMS`, enriched at load (price, rent price, links).

- `PRODUCT_PICKS` maps item id → real retailer `image`, product `url` and `brand`. Items without a pick fall back to generic Unsplash photos.
- Items have `gender: 'women' | 'men'` (default women). `ALL_CATALOG_ITEMS` is everything; `CATALOG_ITEMS` is **women's only** and feeds outfit builders, chat and "Complete the look"; `MEN_CATALOG_ITEMS` is men's.
- Photos are hotlinked and can break; `ShopItemCard` shows a "Photo unavailable" placeholder on error or for logo-like images.
- To add items: add the raw entry, find a real product via Exa (`includeDomains` for the retailers), check the image URL returns an image over ~15KB (a 200 alone isn't enough; one "image" was a store logo), then add it to `PRODUCT_PICKS`.

## Environment

Copy `.env.example` to `.env` (gitignored). `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required or the app is blank. Server-only keys: `GROQ_API_KEY` (photo analysis, chat), `CLAUDE_API_KEY` (chat fallback), `EXA_API_KEY` (shop search), `PEXELS_API_KEY` (image search), `PHOTOROOM_API_KEY` (cutouts), `SUPABASE_SERVICE_ROLE_KEY` (account deletion, cron), `CRON_SECRET` / `RESEND_API_KEY` / `EMAIL_FROM` (inactive-account job). A new key goes into `.env.example` with an empty value, in the same change that first reads it.

## Working well

- Look before you edit: find the existing component, service or pattern and follow it.
- Make the smallest change that fully solves the problem, and finish its callers.
- When there are real alternatives (data model, new dependency, caching), give two or three options with a recommendation and let the user pick before coding.
- Finish by saying what changed, what was checked, and what was not.
