import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ImagePlus, Shirt, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useItemImage } from '@/hooks/useItemImage'
import { compressImage } from '@/lib/imageStorage'
import { analyzeImage } from '@/lib/analyzeImage'
import { fitsBuyBudget, fitsRentBudget, isRentable, recommendForPiece, type BudgetId, type PieceAnchor } from '@/lib/shopping'
import { ALL_CATALOG_ITEMS } from '@/lib/catalogData'
import { formatINR } from '@/lib/shopping'
import type { CatalogItem, ClothingCategory, ClothingItem, UserProfile } from '@/types'

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: 'Tops', bottoms: 'Bottoms', dresses: 'Dresses', outerwear: 'Outerwear', shoes: 'Shoes', accessories: 'Accessories',
}
const SLOT_HEADINGS: Record<ClothingCategory, string> = {
  tops: 'Tops', bottoms: 'Bottoms', dresses: 'Dresses', outerwear: 'Outerwear', shoes: 'Shoes', accessories: 'Accessories',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS) as ClothingCategory[]
const COMPLEMENTS: Record<ClothingCategory, ClothingCategory[]> = {
  tops: ['bottoms', 'shoes', 'outerwear', 'accessories'],
  bottoms: ['tops', 'shoes', 'outerwear', 'accessories'],
  dresses: ['shoes', 'outerwear', 'accessories'],
  outerwear: ['tops', 'bottoms', 'shoes', 'accessories'],
  shoes: ['tops', 'bottoms', 'dresses', 'accessories'],
  accessories: ['tops', 'bottoms', 'dresses', 'shoes'],
}

type PickerSource = 'closet' | 'shop'
type Picked =
  | { kind: 'kloset'; item: ClothingItem }
  | { kind: 'catalog'; item: CatalogItem }
  | { kind: 'anchor'; anchor: PieceAnchor }
  | { kind: 'upload'; previewUrl: string; anchor: PieceAnchor }

interface CompleteAPieceProps {
  budget: BudgetId
  profile: UserProfile | null
  wardrobe: ClothingItem[]
  isInWardrobe: (catalogId: string) => boolean
  initialAnchor?: PieceAnchor
}

const anchorFromItem = (item: ClothingItem): PieceAnchor => ({
  name: item.name, category: item.category, colours: item.colour, occasions: item.occasions, formality: item.formality, imageUrl: item.imageUrl,
})
const anchorFromCatalogItem = (item: CatalogItem): PieceAnchor => ({
  name: item.name, category: item.category, colours: item.colours, occasions: item.occasions, formality: item.formality, imageUrl: item.imageUrl,
})

export function CompleteAPiece({ budget, profile, wardrobe, isInWardrobe, initialAnchor }: CompleteAPieceProps) {
  const [source, setSource] = useState<PickerSource>('closet')
  const [picked, setPicked] = useState<Picked | null>(initialAnchor ? { kind: 'anchor', anchor: initialAnchor } : null)
  const [underBudget, setUnderBudget] = useState(false)
  const [rentOnly, setRentOnly] = useState(false)
  const [addedToOutfit, setAddedToOutfit] = useState<string[]>([])
  const anchor = useMemo(() => picked ? (picked.kind === 'kloset' ? anchorFromItem(picked.item) : picked.kind === 'catalog' ? anchorFromCatalogItem(picked.item) : picked.anchor) : null, [picked])

  const groups = useMemo(() => {
    if (!anchor) return []
    const shopGroups = recommendForPiece(anchor, 'any', profile, 12)
    return COMPLEMENTS[anchor.category].map((category) => {
      let shopMatches = shopGroups.find((group) => group.category === category)?.items ?? []
      if (underBudget) {
        const filterBudget = budget === 'any' ? 'low' : budget
        shopMatches = shopMatches.filter((item) => rentOnly ? fitsRentBudget(item, filterBudget) : fitsBuyBudget(item, filterBudget))
      }
      if (rentOnly) shopMatches = shopMatches.filter(isRentable)
      shopMatches = shopMatches.filter((item) => !isInWardrobe(item.id)).slice(0, 3)
      return { category, shopMatches }
    }).filter((group) => group.shopMatches.length > 0)
  }, [anchor, profile, underBudget, rentOnly, budget, isInWardrobe])

  useEffect(() => {
    if (picked?.kind !== 'upload') return
    const url = picked.previewUrl
    return () => URL.revokeObjectURL(url)
  }, [picked])

  const addKey = (key: string) => setAddedToOutfit((items) => items.includes(key) ? items : [...items, key])
  const closePanel = () => setPicked(null)

  return (
    <div className={clsx('grid items-start gap-6', picked && 'lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]')}>
      <section className={clsx(picked && 'pb-[68dvh] lg:pb-0')} aria-label="Complete a piece">
        <h2 className="mb-1 font-display text-2xl font-medium text-text-primary">What are you completing?</h2>
        <p className="mb-4 text-sm text-text-muted">Choose a piece from your closet or the shop.</p>
        <div className="mb-5 inline-flex rounded-full border border-text-primary/15 bg-surface p-1" role="tablist" aria-label="Choose a piece from">
          {(['closet', 'shop'] as const).map((value) => <button key={value} role="tab" aria-selected={source === value} onClick={() => setSource(value)} className={clsx('rounded-full px-4 py-2 text-xs tracking-normal transition-colors', source === value ? 'bg-text-primary/8 font-medium text-text-primary' : 'text-text-muted hover:text-text-primary')}>{value === 'closet' ? 'My closet' : 'Shop'}</button>)}
        </div>

        {source === 'closet' && wardrobe.length === 0 && <p className="mb-4 text-sm text-text-muted">Your closet is empty. Add a piece or choose one from Shop.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <PhotoUploadTile onReady={(previewUrl, uploadAnchor) => setPicked({ kind: 'upload', previewUrl, anchor: uploadAnchor })} />
          {source === 'closet' ? wardrobe.map((item) => <ClosetPickCard key={item.id} item={item} selected={picked?.kind === 'kloset' && picked.item.id === item.id} onClick={() => { console.log('[complete-a-piece] picked from Kloset', item.id); setPicked({ kind: 'kloset', item }) }} />) : availableShopItems(profile).map((item) => <ShopPickCard key={item.id} item={item} selected={picked?.kind === 'catalog' && picked.item.id === item.id} onClick={() => setPicked({ kind: 'catalog', item })} />)}
        </div>
      </section>

      {picked && anchor && <aside aria-label="Outfit suggestions" className="fixed inset-x-0 bottom-0 z-40 max-h-[68dvh] overflow-y-auto rounded-t-3xl border border-text-primary/10 bg-surface p-4 shadow-lifted lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:rounded-none lg:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-16 w-12 shrink-0 overflow-hidden bg-tile">{picked.kind === 'kloset' ? <KlosetItemImage item={picked.item} /> : <SelectedImage picked={picked} anchor={anchor} />}</div>
            <div className="min-w-0"><p className="text-2xs uppercase tracking-widest text-text-muted">Completing</p><h2 className="truncate font-display text-xl text-text-primary">{anchor.name}</h2><p className="truncate text-xs text-text-muted">Outfit · {addedToOutfit.length} added</p></div>
          </div>
          <button onClick={closePanel} aria-label="Close suggestions" className="shrink-0 p-1 text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>

        {groups.length > 0 && <div className="mb-4 flex flex-wrap gap-2" aria-label="Optional suggestion filters">
          <button onClick={() => setUnderBudget((value) => !value)} aria-pressed={underBudget} className={clsx('rounded-full border px-3 py-1.5 text-xs transition-colors', underBudget ? 'border-text-primary bg-text-primary/8 text-text-primary' : 'border-text-primary/15 text-text-muted hover:border-text-primary/35')}>{underBudget ? 'Under budget · On' : 'Under budget'}</button>
          <button onClick={() => setRentOnly((value) => !value)} aria-pressed={rentOnly} className={clsx('rounded-full border px-3 py-1.5 text-xs transition-colors', rentOnly ? 'border-text-primary bg-text-primary/8 text-text-primary' : 'border-text-primary/15 text-text-muted hover:border-text-primary/35')}>{rentOnly ? 'Rent only · On' : 'Rent only'}</button>
        </div>}

        <div className="space-y-5">
          {groups.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">No matches with these options. Try turning off a filter.</p> : groups.map((group) => <section key={group.category}>
            <h3 className="mb-2 text-xs font-medium text-text-primary">{SLOT_HEADINGS[group.category]}</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {group.shopMatches.map((item) => <OutfitSuggestionCard key={`shop-${item.id}`} name={item.name} category={CATEGORY_LABELS[item.category]} image={<img src={item.imageUrl} alt="" className="h-full w-full object-cover" />} tag={rentOnly ? 'Rent' : undefined} price={rentOnly ? `${formatINR(item.rentPricePerWeek)} / wk` : formatINR(item.estimatedPrice)} added={addedToOutfit.includes(`shop:${item.id}`)} onAdd={() => addKey(`shop:${item.id}`)} />)}
            </div>
          </section>)}
        </div>
      </aside>}
    </div>
  )
}

function availableShopItems(profile: UserProfile | null) {
  const preference = profile?.genderStylePreference
  if (preference === 'feminine') return ALL_CATALOG_ITEMS.filter((item) => item.gender === 'women')
  if (preference === 'masculine') return ALL_CATALOG_ITEMS.filter((item) => item.gender === 'men')
  return ALL_CATALOG_ITEMS
}

function ClosetPickCard({ item, selected, onClick }: { item: ClothingItem; selected: boolean; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={selected} className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow">
    <div className="relative aspect-[3/4] overflow-hidden bg-tile"><KlosetItemImage item={item} /><span className="absolute left-2 top-2 rounded-full bg-warm-cream/90 px-2 py-1 text-2xs uppercase tracking-widest text-text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{CATEGORY_LABELS[item.category]}</span>{selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-warm-cream"><Check size={14} /></span>}</div>
    <p className="mt-2 truncate text-xs text-text-primary">{item.name}</p>
  </button>
}

function ShopPickCard({ item, selected, onClick }: { item: CatalogItem; selected: boolean; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={selected} className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow">
    <div className="relative aspect-[3/4] overflow-hidden bg-tile"><img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /><span className="absolute left-2 top-2 rounded-full bg-warm-cream/90 px-2 py-1 text-2xs uppercase tracking-widest text-text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{CATEGORY_LABELS[item.category]}</span>{selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-warm-cream"><Check size={14} /></span>}</div>
    <p className="mt-2 truncate text-xs text-text-primary">{item.name}</p>
    <p className="truncate text-2xs text-text-muted">{item.brand ?? 'Shop'} · {formatINR(item.estimatedPrice)}</p>
  </button>
}

function OutfitSuggestionCard({ name, category, image, tag, price, added, onAdd }: { name: string; category: string; image: React.ReactNode; tag?: string; price?: string; added: boolean; onAdd: () => void }) {
  return <article className="w-36 shrink-0 sm:w-40">
    <div className="relative mb-2 aspect-[4/3] overflow-hidden bg-tile">{image}{tag && <span className="absolute left-1.5 top-1.5 bg-warm-cream/90 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-primary">{tag}</span>}</div>
    <p className="truncate text-xs text-text-primary" title={name}>{name}</p>
    <p className="truncate text-2xs text-text-muted">{category}{price ? ` · ${price}` : ''}</p>
    <button onClick={onAdd} disabled={added} className="mt-2 w-full border border-text-primary/20 px-2 py-1.5 text-2xs text-text-primary transition-colors hover:border-text-primary/50 disabled:bg-text-primary/5 disabled:text-text-muted">{added ? 'Added to outfit' : 'Add to outfit'}</button>
  </article>
}

function KlosetItemImage({ item }: { item: ClothingItem }) {
  const url = useItemImage(item)
  return url ? <img src={url} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full w-full items-center justify-center"><Shirt size={28} className="text-text-primary/25" /></div>
}

function SelectedImage({ picked, anchor }: { picked: Picked; anchor: PieceAnchor }) {
  if (picked.kind === 'upload') return <img src={picked.previewUrl} alt={anchor.name} className="h-full w-full object-cover" />
  if (picked.kind === 'catalog') return <img src={picked.item.imageUrl} alt={anchor.name} className="h-full w-full object-cover" />
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
