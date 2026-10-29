/**
 * Kloset API — the Express app, shared by both runtimes:
 *   - local dev: server/index.mjs calls app.listen() on port 3001
 *   - Netlify:   netlify/functions/api.mjs wraps it as a serverless function
 *
 * Env vars come from .env locally (loaded by index.mjs) or from the Netlify
 * site's environment variables in production.
 */

import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { isProductPage } from './productPages.mjs'
import { findOutfitProblems } from './outfitRules.mjs'

// ─── App ──────────────────────────────────────────────────────────────────────

export const app = express()

// Only matters in local dev — in production the site and /api share an origin.
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json({ limit: '15mb' }))

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasGroqKey: !!process.env.GROQ_API_KEY,
    hasClaudeKey: !!process.env.CLAUDE_API_KEY,
    hasExaKey: !!process.env.EXA_API_KEY,
    hasPhotoRoomKey: !!process.env.PHOTOROOM_API_KEY,
    timestamp: new Date().toISOString(),
  })
})

// ─── Image search (Pexels) ────────────────────────────────────────────────────

app.get('/api/search-images', async (req, res) => {
  const q = String(req.query.q || 'fashion clothing').trim().slice(0, 100)
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
  const apiKey = process.env.PEXELS_API_KEY

  if (!apiKey) {
    return res.json({ photos: [], noKey: true })
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=18&page=${page}&orientation=portrait`,
      { headers: { Authorization: apiKey } }
    )

    if (!response.ok) throw new Error(`Pexels ${response.status}`)

    const data = await response.json()
    const photos = (data.photos ?? []).map((p) => ({
      id: p.id,
      url: p.src.medium,      // ~1200px wide
      thumbUrl: p.src.small,  // ~280px wide
      alt: p.alt || q,
      photographer: p.photographer,
    }))

    return res.json({ photos, totalResults: data.total_results ?? 0, page })
  } catch (e) {
    console.error('[search-images] Pexels error:', e?.message)
    return res.status(500).json({ photos: [], error: 'Image search failed.' })
  }
})

// ─── Analyze clothing image ───────────────────────────────────────────────────

const PROMPT = `You are a professional fashion analyst. Analyse this clothing item photo and respond with raw JSON only (no markdown fences, no commentary).

Rules:
- Only describe what is clearly visible in the image
- Use null for any field you cannot confidently determine
- name is a short, natural item name like a retailer would use, e.g. "Black Ribbed Turtleneck" or "Camel Wool Overcoat" — colour + material/pattern + garment type, no brand names
- primaryColor must be exactly one of: Black, White, Navy, Charcoal, Camel, Tan, Cream, Beige, Blush, Dusty Rose, Burgundy, Forest Green, Olive, Sage, Rust, Terracotta, Cobalt, Sky Blue, Lavender, Plum, Gold, Silver, Brown, Grey
- category must be exactly one of: tops, bottoms, dresses, outerwear, shoes, accessories
- pattern must be exactly one of: solid, striped, checked, floral, abstract, animal-print, geometric, other
- fit must be exactly one of: slim, regular, relaxed, oversized, fitted (or null)
- formality must be exactly one of: casual, smart casual, business, formal, black tie (or null)
- seasons is an array from: spring, summer, autumn, winter, all-season
- occasions is an array of the occasions this piece realistically suits, from: work, casual, formal, date-night, weekend, travel, gym, special-event — pick 1-4 that fit, based on the garment's formality and style

Respond with this exact JSON structure:
{
  "name": string | null,
  "category": string | null,
  "subcategory": string | null,
  "primaryColor": string | null,
  "secondaryColors": string[],
  "material": string | null,
  "pattern": string | null,
  "fit": string | null,
  "formality": string | null,
  "seasons": string[],
  "occasions": string[],
  "confidence": { "category": number, "color": number, "material": number }
}`

// Shared by both /api/analyze-image (upload) and /api/analyze-image-url
// (pasted URL / Pexels pick) — same vision call either way, only the source
// of the base64 bytes differs.
async function runVisionAnalysis(imageData, mediaType) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { analysis: null, source: 'stub', message: 'Add GROQ_API_KEY to your .env file to enable photo analysis.' }
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mediaType};base64,${imageData}` },
          },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq ${response.status}: ${err}`)
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content ?? ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const analysis = JSON.parse(cleaned)

  return { analysis, source: 'groq' }
}

app.post('/api/analyze-image', async (req, res) => {
  const { imageData, mediaType } = req.body ?? {}

  if (!imageData || typeof imageData !== 'string') {
    return res.status(400).json({ error: 'imageData (base64 string) is required' })
  }
  if (!mediaType || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
    return res.status(400).json({ error: 'mediaType must be image/jpeg, image/png, or image/webp' })
  }

  try {
    const result = await runVisionAnalysis(imageData, mediaType)
    return res.json(result)
  } catch (e) {
    console.error('[analyze-image] Groq error:', e?.message ?? e)
    return res.status(500).json({
      error: 'Photo analysis failed. You can still add the item manually.',
      details: e instanceof Error ? e.message : String(e),
    })
  }
})

// Fetches an arbitrary image URL (pasted by the user, or picked from a Pexels
// search result) server-side and runs the same vision analysis on it — done
// server-side specifically because reading the bytes of a cross-origin image
// from the browser is blocked by CORS for most sites (display via <img> works
// without CORS, but fetch()-ing the bytes to analyze does not).
app.post('/api/analyze-image-url', async (req, res) => {
  const { url } = req.body ?? {}
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  let parsed
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol')
  } catch {
    return res.status(400).json({ error: 'Invalid image URL.' })
  }

  try {
    const imgRes = await fetch(parsed.toString())
    if (!imgRes.ok) throw new Error(`Fetch ${imgRes.status}`)

    const contentType = (imgRes.headers.get('content-type') || '').split(';')[0].trim()
    const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(contentType)
      ? contentType
      : 'image/jpeg'

    const buf = Buffer.from(await imgRes.arrayBuffer())
    if (buf.length > 12 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image is too large to analyse.' })
    }
    const imageData = buf.toString('base64')

    const result = await runVisionAnalysis(imageData, mediaType)
    return res.json(result)
  } catch (e) {
    console.error('[analyze-image-url] error:', e?.message ?? e)
    return res.status(500).json({
      error: 'Photo analysis failed. You can still add the item manually.',
      details: e instanceof Error ? e.message : String(e),
    })
  }
})

// Refine the edges of a garment mask through PhotoRoom. The API key stays on
// the server; callers send a cropped garment image, never the original photo.
app.post('/api/refine-garment-image', async (req, res) => {
  const { imageData, mediaType } = req.body ?? {}
  const apiKey = process.env.PHOTOROOM_API_KEY

  if (!apiKey) return res.status(503).json({ error: 'PhotoRoom is not configured.' })
  if (!imageData || typeof imageData !== 'string') {
    return res.status(400).json({ error: 'imageData (base64 string) is required' })
  }
  if (!mediaType || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
    return res.status(400).json({ error: 'mediaType must be image/jpeg, image/png, or image/webp' })
  }

  try {
    const imageBytes = Buffer.from(imageData, 'base64')
    if (imageBytes.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image is too large for processing.' })
    }

    const form = new FormData()
    form.append('image_file', new Blob([imageBytes], { type: mediaType }), `garment.${mediaType.split('/')[1]}`)
    const response = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form,
    })
    if (!response.ok) {
      console.error(`[refine-garment-image] PhotoRoom ${response.status}:`, (await response.text()).slice(0, 500))
      return res.status(502).json({ error: 'PhotoRoom could not refine this garment.' })
    }

    const output = Buffer.from(await response.arrayBuffer())
    return res.json({ imageData: output.toString('base64'), mediaType: response.headers.get('content-type') || 'image/png' })
  } catch (e) {
    console.error('[refine-garment-image] PhotoRoom error:', e?.message ?? e)
    return res.status(502).json({ error: 'PhotoRoom garment refinement failed.' })
  }
})

// ─── Live web shopping search (Exa) ───────────────────────────────────────────

const RETAILER_DOMAINS = {
  zara: 'zara.com',
  hm: 'hm.com',
  cos: 'cos.com',
  uniqlo: 'uniqlo.com',
  mango: 'mango.com',
  stories: 'stories.com',
  everlane: 'everlane.com',
}
const RETAILER_NAMES = {
  'zara.com': 'Zara',
  'hm.com': 'H&M',
  'cos.com': 'COS',
  'uniqlo.com': 'Uniqlo',
  'mango.com': 'Mango',
  'stories.com': '& Other Stories',
  'everlane.com': 'Everlane',
}

// Identical requests re-hit Exa's paid API otherwise. Process-local, resets
// on restart — fine for a single-instance dev/personal-scale deployment.
const webShopCache = new Map()
const WEB_SHOP_CACHE_TTL_MS = 10 * 60 * 1000

function domainOf(url) {
  try {
    // Strips www., www2., etc — H&M's site serves from www2.hm.com.
    return new URL(url).hostname.replace(/^www\d*\./, '')
  } catch {
    return ''
  }
}

// Suffix match, not exact — retailers serve from regional subdomains Exa
// crawls independently (ae.hm.com, en_ca.hm.com, etc), all still "H&M".
function retailerNameFor(domain) {
  for (const [known, name] of Object.entries(RETAILER_NAMES)) {
    if (domain === known || domain.endsWith(`.${known}`)) return name
  }
  return domain
}

// Exa's /search API has no region/language filter, so a domain-only match
// can surface a non-US, non-English storefront page (e.g. zara.com/es/...,
// or ae.hm.com where the region lives in the subdomain, not the path) above
// a US one. This doesn't remove anything — a niche query might only exist on
// a regional page — it just sorts likely-US/English pages first. Retailers
// don't agree on a country-code standard (Zara uses "uk", ISO uses "gb"), so
// both are covered; checked against path AND hostname to catch either style.
const NON_US_LOCALE_RE = /(?:^|[./_-])(en[-_](gb|uk|ca|au|ie|in|sg|hk|nz|ww|eu)|es|fr|de|it|nl|pt|se|dk|no|fi|pl|ru|ja|jp|ko|kr|zh|cn|tw|ar|ae|sa|mx|br|tr|gb|uk|ca|au|eu)(?:[-_./]|$)/i

function isLikelyNonUS(url) {
  try {
    const u = new URL(url)
    return NON_US_LOCALE_RE.test(u.pathname) || NON_US_LOCALE_RE.test(u.hostname.replace(/^www\d*\./, ''))
  } catch {
    return false
  }
}

// Zara serves crawlers a placeholder title ("Search engine | ZARA United States")
// on real product pages — fall back to the product name in the URL slug,
// e.g. /satin-dress-with-spaghetti-straps-p07904331.html.
function titleFor(r) {
  const title = (r.title ?? '').trim()
  if (title && !/search engine/i.test(title)) return title
  const slug = (() => {
    try { return new URL(r.url).pathname.split('/').pop() ?? '' } catch { return '' }
  })()
  const name = slug.replace(/\.html?$/i, '').replace(/-p\d+$/i, '').replace(/-/g, ' ').trim()
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'View item'
}

app.post('/api/web-shop-search', async (req, res) => {
  const { query, retailers } = req.body ?? {}

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' })
  }

  const includeDomains = (Array.isArray(retailers) && retailers.length
    ? retailers.filter((r) => RETAILER_DOMAINS[r]).map((r) => RETAILER_DOMAINS[r])
    : Object.values(RETAILER_DOMAINS))

  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    console.log('[web-shop-search] no EXA_API_KEY set — returning empty results')
    return res.json({ results: [], noKey: true })
  }

  const trimmedQuery = query.trim().slice(0, 200)
  const cacheKey = `${trimmedQuery.toLowerCase()}|${includeDomains.slice().sort().join(',')}`
  const cached = webShopCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[web-shop-search] cache hit for "${trimmedQuery}"`)
    return res.json({ results: cached.results })
  }

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: trimmedQuery,
        type: 'auto',
        // Over-fetch: listing pages get filtered out below, and the rest
        // still needs to fill a row of product cards.
        numResults: 30,
        includeDomains,
        contents: {
          text: { maxCharacters: 280 },
          highlights: true,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Exa ${response.status}: ${err}`)
    }

    const data = await response.json()
    const raw = data.results ?? []
    // Stable sort, US pages first *before* capping — keeps Exa's relevance
    // order within each group, and regional duplicates can't crowd US
    // products out of the 12 we keep.
    const productHits = raw
      .filter((r) => isProductPage(r.url))
      .sort((a, b) => Number(isLikelyNonUS(a.url)) - Number(isLikelyNonUS(b.url)))
    const results = productHits.slice(0, 12).map((r) => {
      const domain = domainOf(r.url)
      return {
        id: r.id ?? r.url,
        title: titleFor(r),
        url: r.url,
        domain,
        retailer: retailerNameFor(domain),
        snippet: (r.highlights?.[0] ?? r.text ?? '').trim().slice(0, 200),
        // The live site is https — an http:// image is mixed content some browsers block.
        imageUrl: r.image ? r.image.replace(/^http:\/\//i, 'https://') : null,
      }
    })

    webShopCache.set(cacheKey, { results, expiresAt: Date.now() + WEB_SHOP_CACHE_TTL_MS })
    const nonUSCount = results.filter((r) => isLikelyNonUS(r.url)).length
    console.log(`[web-shop-search] "${trimmedQuery}" (${includeDomains.join(',')}) → ${results.length} product pages (${raw.length - productHits.length} listing pages dropped, ${nonUSCount} non-US deprioritized)`)
    return res.json({ results })
  } catch (e) {
    console.error('[web-shop-search] Exa error:', e?.message ?? e)
    return res.status(500).json({ error: 'Live shopping search failed. Try again in a moment.' })
  }
})

// ─── Stylist chat ─────────────────────────────────────────────────────────────

// Groq rejects an oversized request body outright (413), which otherwise
// surfaces to the user as an opaque 500 with no clue why. A giant paste into
// the chat box, or a wardrobe/shop summary that's grown unexpectedly large,
// are the realistic ways this happens — cap everything defensively so one
// runaway field can't blow up the whole request.
const MAX_MESSAGE_CHARS = 4000
const MAX_SUMMARY_CHARS = 6000

function cap(str, max) {
  if (typeof str !== 'string' || str.length <= max) return str
  return str.slice(0, max) + '\n…(truncated)'
}

// Calls Groq's gpt-oss-120b model. Throws with a `.status` set to the
// upstream HTTP status so the caller can tell a capacity issue (429/413)
// apart from a real failure.
// The canned one-liner gpt-oss gives when it decides not to answer — never a
// useful reply in a styling chat.
function isBareRefusal(text) {
  if (typeof text !== 'string') return false
  const t = text.trim()
  return t.length < 200 && /^i[’']?m sorry,? but i (can[’']?t|cannot|won[’']?t)/i.test(t)
}

async function callGroq(apiKey, systemPrompt, recentMessages) {
  const requestBody = JSON.stringify({
    model: 'openai/gpt-oss-120b',
    reasoning_effort: 'low',
    max_tokens: 600,
    messages: [
      { role: 'system', content: systemPrompt },
      ...recentMessages,
    ],
  })

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: requestBody,
    // Netlify kills the function at 10s; give up early enough for the Claude fallback to answer.
    signal: AbortSignal.timeout(6000),
  })

  if (!response.ok) {
    const errText = await response.text()
    const error = new Error(`Groq ${response.status}: ${errText}`)
    error.status = response.status
    throw error
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? null
}

// Fallback path when Groq is unavailable (down, erroring, or rate-limited).
// Claude's Messages API takes the system prompt as its own field rather than
// a role in the messages array, and requires the array to start with a user
// turn — both handled here rather than forcing the Groq-shaped call site to
// know about it.
async function callClaude(apiKey, systemPrompt, recentMessages) {
  const anthropic = new Anthropic({ apiKey })

  const firstUserIdx = recentMessages.findIndex((m) => m.role === 'user')
  const claudeMessages = (firstUserIdx <= 0 ? recentMessages : recentMessages.slice(firstUserIdx))
    .map((m) => ({ role: m.role, content: m.content }))

  if (claudeMessages.length === 0) return null

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 600,
    system: systemPrompt,
    messages: claudeMessages,
  }, { timeout: 7000, maxRetries: 0 })

  return response.content?.find((b) => b.type === 'text')?.text ?? null
}

app.post('/api/chat', async (req, res) => {
  const rawBody = req.body ?? {}
  const messages = Array.isArray(rawBody.messages)
    ? rawBody.messages.map((m) => ({ ...m, content: cap(m.content, MAX_MESSAGE_CHARS) }))
    : rawBody.messages
  const wardrobeSummary = cap(rawBody.wardrobeSummary, MAX_SUMMARY_CHARS)
  const wardrobeGapsSummary = cap(rawBody.wardrobeGapsSummary, MAX_SUMMARY_CHARS)
  const profileSummary = cap(rawBody.profileSummary, MAX_SUMMARY_CHARS)
  const stylePreferencesSummary = cap(rawBody.stylePreferencesSummary, MAX_SUMMARY_CHARS)
  const shopSummary = cap(rawBody.shopSummary, MAX_SUMMARY_CHARS)
  // Name + category only — enough for the outfit check to know that
  // "Blue jeans" is a bottom, whatever slot the model labels it as.
  const wardrobeItems = Array.isArray(rawBody.wardrobeItems)
    ? rawBody.wardrobeItems
        .slice(0, 500)
        .filter((i) => typeof i?.name === 'string' && typeof i?.category === 'string')
        .map((i) => ({ name: i.name.slice(0, 120), category: i.category }))
    : []

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' })
  }

  const groqKey = process.env.GROQ_API_KEY
  const claudeKey = process.env.CLAUDE_API_KEY

  if (!groqKey && !claudeKey) {
    return res.json({
      reply: "I'd love to help you style your wardrobe! Add a Groq or Claude API key to enable chat.",
      source: 'stub',
    })
  }

  const systemPrompt = `You are Kaia, a warm, knowledgeable personal stylist and personal shopper. You speak in a conversational, friendly tone — like a stylish friend who really knows fashion AND actually goes shopping with them. Every reply should feel like it's about THIS person specifically, not generic style advice — use the details below to make that true.
${profileSummary ? `\nAbout this person: ${profileSummary}` : ''}
${wardrobeSummary ? `\nClothes they ACTUALLY OWN, grouped by the outfit slot each one fills (use these for outfit building):\n${wardrobeSummary}` : '\nTheir wardrobe is still being built — encourage them to add items.'}
${wardrobeGapsSummary ? `\nWardrobe patterns and gaps (reason with this, don't recite it back verbatim — it's what makes a recommendation actually personal):\n${wardrobeGapsSummary}` : ''}
${stylePreferencesSummary ? `\nStyle pieces they LOVE but don't necessarily own (use to understand their taste, not as outfit components):\n${stylePreferencesSummary}` : ''}
${shopSummary ? `\nPieces available to buy or rent on the Discover page (Kloset's own curated picks):\n${shopSummary}\nWhen you suggest one, name the piece and its approximate price, mention it can be bought or rented, and point them to the Discover page (it has a budget filter).` : ''}

CRITICAL RULES:
- Only build OUTFITS using pieces they ACTUALLY OWN
- An outfit is a set of DIFFERENT kinds of pieces, one per slot: exactly one Top + exactly one Bottom (or exactly one Dress instead of both), exactly one pair of Shoes, optionally one Outerwear layer, optionally up to 2 Accessories of different kinds. NEVER two pieces from the same slot — no jeans with jeans or trousers, no t-shirt with another t-shirt or shirt, no dress with a skirt. Use the slot heading each owned piece is listed under; don't relabel a piece as a different slot
- Write every outfit as one line per slot, exactly like:
  - Top: White linen shirt
  - Bottom: Blue jeans
  - Shoes: White sneakers
  Use their piece names exactly as listed. For several outfits, put a short heading line (e.g. "Outfit 2 — Evening") between them
- Style preferences and favourites show their taste — use them to judge fit, never treat them as owned
- When wardrobe is small, be creative with combinations and suggest what to add next
- If a good outfit needs a piece they don't own, or a real gap from their wardrobe patterns is worth filling, you may recommend ONE piece — either from Kloset's own catalog above, OR as an external piece to shop for
- A recommended piece must fill a slot the outfit DOESN'T already have from their own clothes (e.g. they have a top and bottom but no shoes → recommend shoes; never recommend jeans for an outfit that already has jeans). Put it in the outfit as its slot line marked "(to buy)", e.g. "- Shoes: tan leather loafers (to buy)", and name the owned pieces it pairs with and why
- Don't bring up brands or stores on your own — describe what to look for, and the live product links that appear below your reply handle where to buy it
- If they ASK for a specific store, that's a normal request — never refuse it. The live links can search Zara, H&M, COS, Uniqlo, Mango, & Other Stories and Everlane: add that store as a third part of the shop tag (see below) so the links come from it. For any other store, say the links come from those stores instead
- If they ask for options or a list rather than one look, answer with a short bullet list of distinct pieces (one line each, no long outfit write-up), each followed by its own shop tag, and let the live links below show the actual products
- Never reply with a bare refusal like "I can't help with that" — every request here is about clothes, so always give a useful styling answer
- Ground every external recommendation in something specific about them: a colour they're missing, a formality gap, a favourite they own, their occupation/lifestyle — say why it complements their closet, not just that it's nice
- When you recommend a specific external piece, end that recommendation with a tag on its own line: [[SHOP: <slot> | <colour> <specific item type>]] — e.g. [[SHOP: shoes | tan leather loafers]] or [[SHOP: bottom | black wide-leg trousers]]. <slot> is one of top, bottom, dress, outerwear, shoes, accessory. When they asked for a specific store from the list above, add it as a third part: [[SHOP: dress | black slip dress | zara]] (one of zara, hm, cos, uniqlo, mango, stories, everlane). The query must name a specific item type (loafers, wide-leg trousers, denim jacket, slip dress) — never just "top" or "shoes" — because it's used to find real individual product pages, which appear below your message. Use one tag per genuinely recommended piece (at most 4, e.g. one per option in a list), never for hypotheticals or general musing
- You have NO live inventory access and have not "found," "seen," or "spotted" any specific external item. Describe the piece only by its colour and item type (the same words as the tag) plus the personal reasoning — don't invent fabric, fit details, or features the real listing might contradict. E.g. correct: "Tan loafers would warm up your white-and-denim look." Wrong: "Buttery soft Italian-leather loafers with a cushioned sole."
- Don't invent specific prices, stock, or exact product names for external pieces
- Keep responses concise (2–4 sentences for simple questions, more for outfit requests)
- When building an outfit, list pieces clearly
- Be encouraging, warm, and fashion-forward`

  // A refusal left in the history makes the model keep refusing ("why" → same line).
  const recentMessages = messages
    .filter((m) => !(m.role === 'assistant' && isBareRefusal(m.content)))
    .slice(-12)

  // Sized to catch exactly this class of bug — a huge paste into the chat
  // input, or a wardrobe/shop summary that's grown unexpectedly large — by
  // showing which piece is bloated before a provider's size limit forces a guess.
  console.log(
    `[chat] sending: systemPrompt=${systemPrompt.length}c ` +
    `wardrobeSummary=${(wardrobeSummary ?? '').length}c ` +
    `wardrobeGapsSummary=${(wardrobeGapsSummary ?? '').length}c ` +
    `shopSummary=${(shopSummary ?? '').length}c ` +
    `history=${recentMessages.length}msgs/${recentMessages.reduce((n, m) => n + (m.content?.length ?? 0), 0)}c`
  )

  // Groq first, Claude as the fallback — used for the first draft and for
  // the rewrite if the draft breaks the outfit rules.
  const generate = async (msgs) => {
    let lastError = null
    if (groqKey) {
      try {
        const reply = await callGroq(groqKey, systemPrompt, msgs)
        if (!isBareRefusal(reply)) return { reply, source: 'groq' }
        // gpt-oss sometimes answers a harmless styling ask with its canned refusal.
        console.warn(`[chat] Groq returned a bare refusal ("${reply}") — trying the fallback`)
        lastError = new Error('Groq refused')
      } catch (e) {
        lastError = e
        const isCapacityIssue = e.status === 429 || e.status === 413
        console.warn(`[chat] Groq ${isCapacityIssue ? 'capacity limit' : 'error'}: ${e.message}`)
      }
    }
    if (claudeKey) {
      try {
        const reply = await callClaude(claudeKey, systemPrompt, msgs)
        console.log(`[chat] served by Claude fallback${groqKey ? ' (Groq failed first)' : ' (no Groq key set)'}`)
        return { reply, source: 'claude-fallback' }
      } catch (e) {
        console.error('[chat] Claude fallback also failed:', e?.message ?? e)
        lastError = e
      }
    }
    return { reply: null, source: null, lastError }
  }

  const started = Date.now()
  let { reply, source, lastError } = await generate(recentMessages)

  // One rewrite at most — bounds latency, and a second draft almost always
  // fixes what it's told about. If it still slips, the user gets it anyway
  // rather than an error.
  if (reply) {
    const problems = findOutfitProblems(reply, wardrobeItems)
    // A rewrite is a second model call; skip it when the first one was slow, or the
    // whole request overruns Netlify's 10s function limit and the phone gets nothing.
    if (problems.length && Date.now() - started > 3500) {
      console.warn(`[chat] outfit rules broken but first draft took ${Date.now() - started}ms, skipping rewrite`)
    } else if (problems.length) {
      console.warn(`[chat] outfit rules broken, asking for a rewrite:\n  - ${problems.join('\n  - ')}`)
      const retry = await generate([
        ...recentMessages,
        { role: 'assistant', content: reply },
        {
          role: 'user',
          content: `(Automated check — not from the user.) Your reply broke the outfit rules:\n- ${problems.join('\n- ')}\nRewrite the whole reply fixing these. Reply with only the corrected message, as if it were your first answer.`,
        },
      ])
      if (retry.reply) {
        const remaining = findOutfitProblems(retry.reply, wardrobeItems)
        console.log(`[chat] rewrite ${remaining.length ? `still has ${remaining.length} problem(s): ${remaining.join(' | ')}` : 'passes the outfit rules'}`)
        reply = retry.reply
        source = retry.source
      } else {
        console.warn('[chat] rewrite failed — returning the first draft')
      }
    }
  }

  if (reply) {
    const hasShopTag = /\[\[SHOP:/i.test(reply)
    console.log(`[chat] ${messages.length} messages in → reply ${reply.length} chars via ${source}${hasShopTag ? ' (includes [[SHOP]] tag)' : ''}`)
    return res.json({ reply, source })
  }

  // Both providers unavailable or failed. A pure capacity issue (and no
  // Claude key to fall back to) still gets the friendly in-character
  // message; anything else is a real error.
  const isCapacityIssue = lastError?.status === 429 || lastError?.status === 413
  if (isCapacityIssue) {
    return res.json({
      reply: "I'm juggling a lot of style requests right now — give me about 10-15 seconds and ask again!",
      source: 'rate-limit',
    })
  }

  console.error('[chat] All providers failed:', lastError?.message ?? 'no providers configured')
  return res.status(500).json({ reply: "I'm having a moment — please try again!", source: 'error' })
})
