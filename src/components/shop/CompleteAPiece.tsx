import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ImagePlus, Shirt } from 'lucide-react'
import { clsx } from 'clsx'
import { useItemImage } from '@/hooks/useItemImage'
import { compressImage } from '@/lib/imageStorage'
import { analyzeImage } from '@/lib/analyzeImage'
import { BUDGET_BANDS, type BudgetId, type PieceAnchor } from '@/lib/shopping'
import { buildPieceQueries, filterForUser } from '@/lib/discoverFeed'
import { parsePrice, useLiveProducts } from '@/lib/liveShop'
import { learnTasteProfile, type RecommendationFeedback } from '@/lib/recommendationFeedback'
import { BudgetDropdown } from '@/components/shop/BudgetDropdown'
import type { ClothingCategory, ClothingItem, UserProfile } from '@/types'

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: 'Tops', bottoms: 'Bottoms', dresses: 'Dresses', outerwear: 'Woolens', shoes: 'Shoes', accessories: 'Accessories',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS) as ClothingCategory[]
// What to suggest for each kind of piece, most needed first; three groups at most.
const COMPLEMENTS: Record<ClothingCategory, ClothingCategory[]> = {
  tops: ['bottoms', 'shoes', 'outerwear'],
  bottoms: ['tops', 'shoes', 'outerwear'],
  dresses: ['shoes', 'outerwear', 'accessories'],
  outerwear: ['tops', 'bottoms', 'shoes'],
  shoes: ['tops', 'bottoms', 'accessories'],
  accessories: ['tops', 'bottoms', 'dresses'],
}

type Picked =
  | { kind: 'kloset'; item: ClothingItem }
  | { kind: 'anchor'; anchor: PieceAnchor }
  | { kind: 'upload'; previewUrl: string; anchor: PieceAnchor }

interface CompleteAPieceProps {
  profile: UserProfile | null
  wardrobe: ClothingItem[]
  feedback: RecommendationFeedback[]
  initialAnchor?: PieceAnchor
}

const anchorFromItem = (item: ClothingItem): PieceAnchor => ({
  name: item.name, category: item.category, colours: item.colour, occasions: item.occasions, formality: item.formality, imageUrl: item.imageUrl,
})

/** Pick a piece (from the closet or a photo); live picks that go with it, by category. */
export function CompleteAPiece({ profile, wardrobe, feedback, initialAnchor }: CompleteAPieceProps) {
  const [picked, setPicked] = useState<Picked | null>(initialAnchor ? { kind: 'anchor', anchor: initialAnchor } : null)
  const [addedToOutfit, setAddedToOutfit] = useState<string[]>([])
  const [budget, setBudget] = useState<BudgetId>('any')
  const [customAmount, setCustomAmount] = useState(6500)
  const anchor = useMemo(() => picked ? (picked.kind === 'kloset' ? anchorFromItem(picked.item) : picked.anchor) : null, [picked])
  const band = BUDGET_BANDS.find((candidate) => candidate.id === budget) ?? BUDGET_BANDS[0]
  const budgetRange: [number, number] | null = budget === 'any' ? null : budget === 'custom' ? [0, customAmount > 0 ? customAmount : Infinity] : band.buy

  useEffect(() => {
    if (picked?.kind !== 'upload') return
    const url = picked.previewUrl
    return () => URL.revokeObjectURL(url)
  }, [picked])

  const addKey = (key: string) => setAddedToOutfit((items) => items.includes(key) ? items : [...items, key])
  const closePanel = () => setPicked(null)

  return (
    <div className="w-full">
      {!picked && <section aria-label="Choose a piece to complete">
        <h2 className="mb-1 font-display text-2xl font-medium text-text-primary">What are you completing?</h2>
        <p className="mb-4 text-sm text-text-muted">Choose a piece from your closet, or upload a photo of one.</p>
        {wardrobe.length === 0 && <p className="mb-4 text-sm text-text-muted">Your closet is empty. Upload a photo of the piece instead.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <PhotoUploadTile onReady={(previewUrl, uploadAnchor) => setPicked({ kind: 'upload', previewUrl, anchor: uploadAnchor })} />
          {wardrobe.map((item) => <ClosetPickCard key={item.id} item={item} selected={false} onClick={() => { console.log('[complete-a-piece] picked from Kloset', item.id); setPicked({ kind: 'kloset', item }) }} />)}
        </div>
      </section>}

      {picked && anchor && <section aria-label="Outfit suggestions" className="grid w-full gap-8 py-3 lg:grid-cols-[minmax(260px,340px)_1fr] lg:gap-12">
        {/* The piece being completed: large, and kept in view while the suggestions scroll. */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-2xs uppercase tracking-widest text-text-muted">Completing</p>
            <button onClick={closePanel} className="-mr-2 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-text-muted hover:bg-text-primary/5 hover:text-text-primary"><ArrowLeft size={14} strokeWidth={1.5} />Choose another</button>
          </div>
          <div className="mx-auto aspect-[3/4] max-h-[55vh] w-full max-w-sm overflow-hidden bg-tile lg:max-h-none lg:max-w-none">
            {picked.kind === 'kloset' ? <KlosetItemImage item={picked.item} /> : <SelectedImage picked={picked} anchor={anchor} />}
          </div>
          <h2 className="mt-4 font-display text-2xl leading-tight text-text-primary lg:text-3xl">{anchor.name}</h2>
          <p className="mt-1 text-xs text-text-muted">{CATEGORY_LABELS[anchor.category]}</p>
          <div className="mt-5 border-t border-text-primary/10 pt-4" aria-label="Suggestion filters">
            <BudgetDropdown value={budget} onChange={setBudget} customAmount={customAmount} onCustomAmountChange={setCustomAmount} mode="buy" />
          </div>
        </aside>

        <div className="min-w-0 space-y-10">
          {COMPLEMENTS[anchor.category]
            .filter((category) => profile?.genderStylePreference !== 'masculine' || category !== 'dresses')
            .map((category) => <LiveGroup key={`${anchor.name}:${category}`} profile={profile} feedback={feedback} anchor={anchor} category={category} budgetRange={budgetRange} added={addedToOutfit} onAdd={addKey} />)}
          <p className="text-center text-[10px] text-text-muted">Live from stores. Prices and stock are set by each store and may change.</p>
        </div>
      </section>}
    </div>
  )
}

/** One category of live picks that go with the anchor piece. */
function LiveGroup({ profile, feedback, anchor, category, budgetRange, added, onAdd }: {
  profile: UserProfile | null
  feedback: RecommendationFeedback[]
  anchor: PieceAnchor
  category: ClothingCategory
  budgetRange: [number, number] | null
  added: string[]
  onAdd: (key: string) => void
}) {
  const taste = useMemo(() => learnTasteProfile(feedback), [feedback])
  const { items, loading, status, retry } = useLiveProducts((page) => buildPieceQueries(profile, anchor, page, [category], taste.avoids.colours))
  const visible = useMemo(() => {
    let list = filterForUser(items, profile, taste, new Set())
    if (budgetRange) list = list.filter((item) => { const price = parsePrice(item.price); return !!price && price.currency === '₹' && price.amount >= budgetRange[0] && price.amount <= budgetRange[1] })
    return list.slice(0, 8)
  }, [items, profile, taste, budgetRange])

  return <section>
    <h3 className="mb-3 font-display text-xl text-text-primary">{CATEGORY_LABELS[category]}</h3>
    {status === 'error' || status === 'no-key' ? (
      <p className="py-4 text-sm text-text-muted">Couldn’t load live picks right now. <button onClick={() => void retry()} className="underline underline-offset-4 hover:text-text-primary">Try again</button></p>
    ) : !loading && !visible.length ? (
      <p className="py-4 text-sm text-text-muted">{budgetRange ? 'Nothing here shows a price in your budget.' : 'No live matches this time.'}</p>
    ) : (
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
        {visible.map((item) => <OutfitSuggestionCard key={item.id} name={item.title} category={item.retailer} image={<img src={item.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />} href={item.url} price={item.price ?? undefined} added={added.includes(item.id)} onAdd={() => onAdd(item.id)} />)}
        {loading && Array.from({ length: 4 }).map((_, i) => <div key={`skeleton-${i}`} className="animate-pulse"><div className="aspect-[3/4] bg-text-primary/8" /><div className="mt-2 h-3 w-3/4 bg-text-primary/8" /></div>)}
      </div>
    )}
  </section>
}

function ClosetPickCard({ item, selected, onClick }: { item: ClothingItem; selected: boolean; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={selected} className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow">
    <div className="relative aspect-[3/4] overflow-hidden bg-tile"><KlosetItemImage item={item} />{selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-warm-cream"><Check size={14} /></span>}</div>
    <p className="mt-2 truncate text-xs text-text-primary">{item.name}</p>
  </button>
}

function OutfitSuggestionCard({ name, category, image, href, price, added, onAdd }: { name: string; category: string; image: React.ReactNode; href: string; price?: string; added: boolean; onAdd: () => void }) {
  return <article className="group relative min-w-0">
    <div className="relative mb-2 aspect-[3/4] overflow-hidden bg-tile">
      <a href={href} target="_blank" rel="noreferrer" aria-label={`View ${name} on seller website`} className="absolute inset-0">{image}</a>
      <button onClick={onAdd} disabled={added} className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-warm-cream px-3 py-1.5 text-2xs text-text-primary opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 disabled:opacity-80">{added ? 'Added to outfit' : 'Add to outfit'}</button>
    </div>
    <a href={href} target="_blank" rel="noreferrer" className="block">
      <p className="mt-2 truncate text-xs text-text-primary" title={name}>{name}</p>
      <p className="truncate text-2xs text-text-muted">{category}{price ? ` · ${price}` : ''}</p>
    </a>
  </article>
}

function KlosetItemImage({ item }: { item: ClothingItem }) {
  const url = useItemImage(item)
  return url ? <img src={url} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full w-full items-center justify-center"><Shirt size={28} className="text-text-primary/25" /></div>
}

function SelectedImage({ picked, anchor }: { picked: Picked; anchor: PieceAnchor }) {
  if (picked.kind === 'upload') return <img src={picked.previewUrl} alt={anchor.name} className="h-full w-full object-cover" />
  if (anchor.imageUrl) return <img src={anchor.imageUrl} alt={anchor.name} className="h-full w-full object-cover" />
  return <div className="h-full w-full bg-tile" />
}

function PhotoUploadTile({ onReady }: { onReady: (previewUrl: string, anchor: PieceAnchor) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'need-category' | 'error'>('idle')
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('That file isn’t an image.'); setStatus('error'); return }
    setStatus('reading'); setError('')
    try {
      const blob = await compressImage(file)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      console.log('[complete-a-piece] analysing upload')
      const analysis = await analyzeImage(blob).catch((err) => { console.error('[complete-a-piece] analysis failed', err); return null })
      const category = analysis?.category as ClothingCategory | undefined
      if (analysis && category && CATEGORIES.includes(category)) {
        onReady(url, { name: analysis.name ?? `Your ${CATEGORY_LABELS[category].toLowerCase()}`, category, colours: [analysis.primaryColor, ...(analysis.secondaryColors ?? [])].filter(Boolean) as string[], occasions: analysis.occasions ?? [], formality: analysis.formality, imageUrl: url })
      } else setStatus('need-category')
    } catch (err) {
      console.error('[complete-a-piece] upload failed', err)
      setError(err instanceof Error ? err.message : 'Couldn’t read that photo.')
      setStatus('error')
    }
  }

  return <div className="relative">
    <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]) }} disabled={status === 'reading'} className={clsx('flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 border border-dashed transition-colors', dragging ? 'border-butter-yellow bg-butter-yellow/5' : 'border-text-primary/25 hover:border-text-primary/50')}>
      {status === 'reading' ? <><div className="h-5 w-5 animate-spin rounded-full border-2 border-butter-yellow/30 border-t-butter-yellow" /><span className="text-2xs text-text-muted">Reading…</span></> : <><ImagePlus size={24} className="text-text-primary/45" /><span className="text-xs text-text-primary">+ Upload</span></>}
    </button>
    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = '' }} />
    {status === 'error' && <p className="mt-1 text-2xs text-red-700">{error}</p>}
    {status === 'need-category' && previewUrl && <div className="absolute inset-1 flex flex-col justify-end gap-1 bg-warm-cream/95 p-2"><p className="text-2xs text-text-primary">Choose category</p><div className="flex flex-wrap gap-1">{CATEGORIES.map((category) => <button key={category} onClick={() => onReady(previewUrl, { name: `Your ${CATEGORY_LABELS[category].toLowerCase()}`, category, colours: [], occasions: [], imageUrl: previewUrl })} className="rounded-full border border-text-primary/20 px-2 py-1 text-[9px] text-text-primary">{CATEGORY_LABELS[category]}</button>)}</div></div>}
  </div>
}
