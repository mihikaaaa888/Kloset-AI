import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { searchWebShop, cleanProductTitle } from '@/lib/webShopService'
import { CATALOG_ITEMS } from '@/lib/catalogData'
import { formatINR } from '@/lib/shopping'
import type { OutfitSuggestion } from '@/lib/stylist'
import type { ClothingCategory } from '@/types'

type MissingRole = 'top' | 'bottom' | 'outerwear' | 'shoes'

const ROLE_NOUN: Record<MissingRole, string> = { top: 'top', bottom: 'trousers', outerwear: 'jacket', shoes: 'shoes' }
const ROLE_LABEL: Record<MissingRole, string> = { top: 'A top', bottom: 'A bottom', outerwear: 'A layer', shoes: 'Shoes' }
const ROLE_CATEGORY: Record<MissingRole, ClothingCategory> = { top: 'tops', bottom: 'bottoms', outerwear: 'outerwear', shoes: 'shoes' }
const OCCASION_WORD: Record<string, string> = {
  work: 'work', casual: 'casual', 'date-night': 'evening', formal: 'formal', weekend: 'weekend',
  travel: 'travel', 'special-event': 'occasion', gym: 'sport',
}

/** What the generated outfit still needs, given the pieces the Kloset could supply. */
function findMissingRoles(suggestion: OutfitSuggestion): MissingRole[] {
  const roles = new Set(suggestion.items.map((i) => i.role))
  const missing: MissingRole[] = []
  if (!roles.has('dress')) {
    if (!roles.has('top')) missing.push('top')
    if (!roles.has('bottom')) missing.push('bottom')
  }
  if (['cold', 'cool', 'rainy'].includes(suggestion.weather) && !roles.has('outerwear')) missing.push('outerwear')
  if (!roles.has('shoes')) missing.push('shoes')
  return missing.slice(0, 2)
}

interface Suggestion {
  id: string
  title: string
  url: string
  imageUrl: string | null
  price?: number
}

function MissingPiece({ role, suggestion }: { role: MissingRole; suggestion: OutfitSuggestion }) {
  const [results, setResults] = useState<Suggestion[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const colour = suggestion.items[0]?.item.colour[0]?.toLowerCase() ?? ''
    const query = `${colour} ${OCCASION_WORD[suggestion.occasion] ?? ''} ${ROLE_NOUN[role]}`.replace(/\s+/g, ' ').trim()

    // Fallback: the best-matching piece from Kloset's own catalog.
    const catalogFallback = (): Suggestion[] => {
      const inCategory = CATALOG_ITEMS.filter((c) => c.category === ROLE_CATEGORY[role])
      const match = inCategory.find((c) => c.occasions.includes(suggestion.occasion)) ?? inCategory[0]
      return match ? [{ id: match.id, title: match.name, url: match.shopUrl, imageUrl: match.imageUrl, price: match.estimatedPrice }] : []
    }

    console.log('[complete-the-look] searching', { role, query })
    searchWebShop(query)
      .then(({ results: found, noKey, error }) => {
        if (cancelled) return
        if (noKey || error || !found.length) {
          console.log('[complete-the-look] no live results, using catalog', { role, noKey, error })
          setResults(catalogFallback())
          return
        }
        setResults(found.slice(0, 2).map((r) => ({ id: r.id, title: cleanProductTitle(r.title), url: r.url, imageUrl: r.imageUrl })))
      })
      .catch((err) => {
        console.error('[complete-the-look] search failed', err)
        if (!cancelled) setResults(catalogFallback())
      })
    return () => { cancelled = true }
  }, [role, suggestion])

  return (
    <div>
      <p className="text-2xs uppercase tracking-widest text-text-muted mb-2">{ROLE_LABEL[role]}</p>
      {results === null ? (
        <div className="h-16 bg-text-primary/5 animate-pulse" />
      ) : results.length === 0 ? (
        <p className="text-xs text-text-muted">Nothing found right now.</p>
      ) : (
        <ul className="space-y-3">
          {results.map((r) => (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => { console.log('[complete-the-look] open', { role, id: r.id }) }}
                className="group flex items-center gap-3"
              >
                <div className="w-14 h-16 flex-shrink-0 bg-cream-200 overflow-hidden">
                  {r.imageUrl && <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary leading-snug line-clamp-2 group-hover:underline underline-offset-4">{r.title}</p>
                  {r.price && <p className="text-xs font-semibold text-text-primary mt-0.5">{formatINR(r.price)}</p>}
                </div>
                <ArrowUpRight size={14} className="text-butter-yellow flex-shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Suggests pieces to buy for whatever the outfit is missing — no brand names, just the piece and a link. */
export function CompleteTheLook({ suggestion }: { suggestion: OutfitSuggestion }) {
  const missing = findMissingRoles(suggestion)
  if (missing.length === 0) return null

  return (
    <div className="border-t border-text-primary/10 pt-5">
      <p className="text-xs font-medium uppercase tracking-widest text-butter-yellow mb-1">Complete the look</p>
      <p className="text-sm text-text-muted mb-4">Your Kloset doesn&apos;t have these yet — here&apos;s what would finish it.</p>
      <div className="space-y-5">
        {missing.map((role) => (
          <MissingPiece key={role} role={role} suggestion={suggestion} />
        ))}
      </div>
    </div>
  )
}
