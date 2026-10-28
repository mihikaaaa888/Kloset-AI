import { apiUrl } from '@/lib/apiUrl'
import type { CatalogItem, ClothingCategory, ClothingItem, UserProfile } from '@/types'
import { CATALOGUE_ITEMS } from '@/pages/onboarding/catalogueData'
import { CATALOG_ITEMS } from '@/lib/catalogData'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// A compact, representative slice of the shoppable catalog (not all 39+
// items — keeps the prompt small) so Kaia can name real pieces with real
// prices instead of vaguely gesturing at "you could buy something".
function buildShopSummary(): string {
  const perCategory = new Map<string, CatalogItem[]>()
  for (const item of CATALOG_ITEMS) {
    const list = perCategory.get(item.category) ?? []
    if (list.length < 3) list.push(item)
    perCategory.set(item.category, list)
  }
  return [...perCategory.values()]
    .flat()
    .map((i) => `- ${i.name} (${i.category}) — buy ~₹${i.estimatedPrice}, rent ~₹${i.rentPricePerWeek}/wk`)
    .join('\n')
}

// Grouped under the outfit slot each piece fills, so Kaia can see at a
// glance that jeans and trousers are both a Bottom and never pair them.
const SLOT_HEADINGS: Record<ClothingCategory, string> = {
  tops: 'Top',
  bottoms: 'Bottom',
  dresses: 'Dress',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  accessories: 'Accessory',
}

function buildWardrobeSummary(items: ClothingItem[]): string {
  if (items.length === 0) return ''
  return (Object.keys(SLOT_HEADINGS) as ClothingCategory[])
    .map((category) => {
      const inSlot = items.filter((i) => i.category === category)
      if (!inSlot.length) return null
      const lines = inSlot.map((item) => {
        const parts = [item.name]
        if (item.subcategory) parts.push(item.subcategory)
        if (item.colour.length) parts.push(item.colour.join('/'))
        if (item.material) parts.push(item.material)
        return `- ${parts.join(', ')}`
      })
      return `${SLOT_HEADINGS[category]}:\n${lines.join('\n')}`
    })
    .filter(Boolean)
    .join('\n')
}

const ALL_CATEGORIES: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories']

// Turns the flat wardrobe list into the signal that actually makes a
// recommendation feel personal: what's missing, what dominates, what they
// reach for. Kaia reasons over this instead of just listing every item back.
function buildWardrobeGapsSummary(items: ClothingItem[]): string {
  if (items.length === 0) return ''

  const categoryCounts = ALL_CATEGORIES.map((c) => ({
    category: c,
    count: items.filter((i) => i.category === c).length,
  }))
  const missing = categoryCounts.filter((x) => x.count === 0).map((x) => x.category)
  const thin = categoryCounts.filter((x) => x.count > 0 && x.count <= 1).map((x) => x.category)

  const colourCounts = new Map<string, number>()
  for (const item of items) {
    for (const c of item.colour) colourCounts.set(c, (colourCounts.get(c) ?? 0) + 1)
  }
  const dominantColours = [...colourCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c]) => c)

  const hasFormal = items.some((i) => /formal|business/i.test(i.formality ?? ''))

  const favourites = items.filter((i) => i.isFavourite).map((i) => i.name)
  const mostWorn = [...items]
    .filter((i) => i.timesWorn > 0)
    .sort((a, b) => b.timesWorn - a.timesWorn)
    .slice(0, 3)
    .map((i) => i.name)

  const lines: string[] = []
  if (missing.length) lines.push(`Owns zero pieces in: ${missing.join(', ')}`)
  if (thin.length) lines.push(`Very thin (1 piece) in: ${thin.join(', ')}`)
  if (dominantColours.length) lines.push(`Dominant colour palette: ${dominantColours.join(', ')}`)
  if (!hasFormal) lines.push('No formal/business-formality pieces yet')
  if (favourites.length) lines.push(`Marked as favourites: ${favourites.join(', ')}`)
  if (mostWorn.length) lines.push(`Reaches for most often: ${mostWorn.join(', ')}`)

  return lines.join('\n')
}

function buildStylePreferencesSummary(selectionIds: string[]): string {
  if (!selectionIds?.length) return ''
  const items = CATALOGUE_ITEMS.filter((c) => selectionIds.includes(c.id))
  if (!items.length) return ''

  const byCategory = items.reduce<Record<string, string[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(`${item.label} (${item.colour})`)
    return acc
  }, {})

  return Object.entries(byCategory)
    .map(([cat, names]) => `${cat}: ${names.join(', ')}`)
    .join('\n')
}

function buildProfileSummary(profile: UserProfile | null): string {
  if (!profile) return ''
  const parts: string[] = []
  if (profile.name) parts.push(`Name: ${profile.name}`)
  if (profile.occupation) parts.push(`Occupation: ${profile.occupation}`)
  if (profile.lifestyle) parts.push(`Lifestyle: ${profile.lifestyle}`)
  if (profile.stylePreferences.length) parts.push(`Style aesthetic: ${profile.stylePreferences.join(', ')}`)
  if (profile.typicalOccasions.length) parts.push(`Typical occasions: ${profile.typicalOccasions.join(', ')}`)
  if (profile.favouriteColours.length) parts.push(`Favourite colours: ${profile.favouriteColours.join(', ')}`)
  if (profile.avoidColours.length) parts.push(`Avoid: ${profile.avoidColours.join(', ')}`)
  return parts.join('. ')
}

export async function sendChatMessage(
  messages: ChatMessage[],
  wardrobe: ClothingItem[],
  profile: UserProfile | null
): Promise<string> {
  const wardrobeSummary = buildWardrobeSummary(wardrobe)
  const wardrobeGapsSummary = buildWardrobeGapsSummary(wardrobe)
  const profileSummary = buildProfileSummary(profile)
  const stylePreferencesSummary = profile?.styleItemSelections
    ? buildStylePreferencesSummary(profile.styleItemSelections)
    : ''
  const shopSummary = buildShopSummary()

  const body = JSON.stringify({
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    wardrobeSummary,
    wardrobeGapsSummary,
    profileSummary,
    stylePreferencesSummary,
    shopSummary,
    // Lets the server check each outfit line against the real category.
    wardrobeItems: wardrobe.map((i) => ({ name: i.name, category: i.category })),
  })

  // Phones drop requests when switching networks or waking up; one quiet retry covers most of it.
  let response: Response
  try {
    response = await postChat(body)
  } catch (e) {
    console.warn('[chat] network error, retrying once', e)
    response = await postChat(body)
  }

  // The server sends an in-character `reply` even with its errors, so show that when there is one.
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('[chat] request failed', response.status, data)
    if (data?.reply) return data.reply
    throw new Error(`Chat request failed (${response.status})`)
  }
  console.log('[chat] reply received', { source: data?.source })
  return data?.reply ?? "I'm not sure what to say — try asking again."
}

function postChat(body: string): Promise<Response> {
  return fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}
