import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ImagePlus, Shirt } from 'lucide-react'
import { clsx } from 'clsx'
import { useItemImage } from '@/hooks/useItemImage'
import { compressImage } from '@/lib/imageStorage'
import { analyzeImage } from '@/lib/analyzeImage'
import { fitsBuyBudget, fitsRentBudget, isRentable, recommendForPiece, type BudgetId, type PieceAnchor } from '@/lib/shopping'
import { ALL_CATALOG_ITEMS } from '@/lib/catalogData'
import { formatINR } from '@/lib/shopping'
import { BudgetDropdown } from '@/components/shop/BudgetDropdown'
import type { CatalogItem, ClothingCategory, ClothingItem, UserProfile } from '@/types'

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: 'Tops', bottoms: 'Bottoms', dresses: 'Dresses', outerwear: 'Woolens', shoes: 'Shoes', accessories: 'Accessories',
}
const SLOT_HEADINGS: Record<ClothingCategory, string> = {
  tops: 'Tops', bottoms: 'Bottoms', dresses: 'Dresses', outerwear: 'Woolens', shoes: 'Shoes', accessories: 'Accessories',
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
  onBudgetChange: (budget: BudgetId) => void
  customBudgetAmount: number
  onCustomBudgetAmountChange: (amount: number) => void
  mode: 'buy' | 'rent'
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

export function CompleteAPiece({ budget, onBudgetChange, customBudgetAmount, onCustomBudgetAmountChange, mode, profile, wardrobe, isInWardrobe, initialAnchor }: CompleteAPieceProps) {
  const [source, setSource] = useState<PickerSource>('closet')
  const [picked, setPicked] = useState<Picked | null>(initialAnchor ? { kind: 'anchor', anchor: initialAnchor } : null)
  const [addedToOutfit, setAddedToOutfit] = useState<string[]>([])
  const anchor = useMemo(() => picked ? (picked.kind === 'kloset' ? anchorFromItem(picked.item) : picked.kind === 'catalog' ? anchorFromCatalogItem(picked.item) : picked.anchor) : null, [picked])

  const groups = useMemo(() => {
    if (!anchor) return []
    const shopGroups = recommendForPiece(anchor, 'any', profile, 12)
    return COMPLEMENTS[anchor.category].map((category) => {
      let shopMatches = shopGroups.find((group) => group.category === category)?.items ?? []
      shopMatches = shopMatches.filter((item) => mode === 'rent' ? isRentable(item) : true)
      if (budget !== 'any') shopMatches = shopMatches.filter((item) => mode === 'rent' ? fitsRentBudget(item, budget, customBudgetAmount) : fitsBuyBudget(item, budget, customBudgetAmount))
      shopMatches = shopMatches.filter((item) => !isInWardrobe(item.id)).slice(0, 3)
      return { category, shopMatches }
    }).filter((group) => group.shopMatches.length > 0)
  }, [anchor, profile, budget, customBudgetAmount, isInWardrobe, mode])

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
        <p className="mb-4 text-sm text-text-muted">Choose a piece from your closet or the shop.</p>
        <div className="mb-5 inline-flex rounded-full border border-text-primary/15 bg-surface p-1" role="tablist" aria-label="Choose a piece from">
          {(['closet', 'shop'] as const).map((value) => <button key={value} role="tab" aria-selected={source === value} onClick={() => setSource(value)} className={clsx('rounded-full px-4 py-2 text-xs tracking-normal transition-colors', source === value ? 'bg-text-primary/8 font-medium text-text-primary' : 'text-text-muted hover:text-text-primary')}>{value === 'closet' ? 'My closet' : 'Shop'}</button>)}
        </div>

        {source === 'closet' && wardrobe.length === 0 && <p className="mb-4 text-sm text-text-muted">Your closet is empty. Add a piece or choose one from Shop.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <PhotoUploadTile onReady={(previewUrl, uploadAnchor) => setPicked({ kind: 'upload', previewUrl, anchor: uploadAnchor })} />
          {source === 'closet' ? wardrobe.map((item) => <ClosetPickCard key={item.id} item={item} selected={picked?.kind === 'kloset' && picked.item.id === item.id} onClick={() => { console.log('[complete-a-piece] picked from Kloset', item.id); setPicked({ kind: 'kloset', item }) }} />) : availableShopItems(profile).map((item) => <ShopPickCard key={item.id} item={item} selected={picked?.kind === 'catalog' && picked.item.id === item.id} onClick={() => setPicked({ kind: 'catalog', item })} />)}
        </div>
      </section>}

      {picked && anchor && <section aria-label="Outfit suggestions" className="min-h-[70vh] w-full py-3">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-16 w-12 shrink-0 overflow-hidden bg-tile">{picked.kind === 'kloset' ? <KlosetItemImage item={picked.item} /> : <SelectedImage picked={picked} anchor={anchor} />}</div>
            <div className="min-w-0"><p className="text-2xs uppercase tracking-widest text-text-muted">Completing</p><h2 className="truncate font-display text-xl text-text-primary">{anchor.name}</h2></div>
          </div>
          <button onClick={closePanel} aria-label="Choose a different piece" title="Choose a different piece" className="shrink-0 rounded-full p-2 text-text-muted hover:bg-text-primary/5 hover:text-text-primary"><ArrowLeft size={18} strokeWidth={1.5} /></button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3" aria-label="Suggestion filters">
          <BudgetDropdown value={budget} onChange={onBudgetChange} customAmount={customBudgetAmount} onCustomAmountChange={onCustomBudgetAmountChange} mode={mode} />
        </div>

        {mode === 'rent' && <div role="status" className="mb-4 border border-text-primary/10 bg-text-primary/[0.03] px-4 py-3 text-center font-display text-lg text-text-primary">Rentals are coming soon</div>}

        <div className="space-y-5">
          {groups.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">No matches with these options. Try turning off a filter.</p> : groups.map((group) => <section key={group.category}>
            <h3 className="mb-2 text-xs font-medium text-text-primary">{SLOT_HEADINGS[group.category]}</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {group.shopMatches.map((item) => <OutfitSuggestionCard key={`shop-${item.id}`} name={item.name} category={CATEGORY_LABELS[item.category]} image={<img src={item.imageUrl} alt="" className="h-full w-full object-cover" />} href={mode === 'rent' ? item.rentUrl : item.shopUrl} price={mode === 'rent' ? `${formatINR(item.rentPricePerWeek)} / wk` : formatINR(item.estimatedPrice)} added={addedToOutfit.includes(`shop:${item.id}`)} onAdd={() => addKey(`shop:${item.id}`)} />)}
            </div>
          </section>)}
        </div>
      </section>}
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
    <div className="relative aspect-[3/4] overflow-hidden bg-tile"><KlosetItemImage item={item} />{selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-warm-cream"><Check size={14} /></span>}</div>
    <p className="mt-2 truncate text-xs text-text-primary">{item.name}</p>
  </button>
}

function ShopPickCard({ item, selected, onClick }: { item: CatalogItem; selected: boolean; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={selected} className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow">
    <div className="relative aspect-[3/4] overflow-hidden bg-tile"><img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />{selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-warm-cream"><Check size={14} /></span>}</div>
    <p className="mt-2 truncate text-xs text-text-primary">{item.name}</p>
    <p className="truncate text-2xs text-text-muted">{item.brand ?? 'Shop'} · {formatINR(item.estimatedPrice)}</p>
  </button>
}

function OutfitSuggestionCard({ name, category, image, href, price, added, onAdd }: { name: string; category: string; image: React.ReactNode; href: string; price?: string; added: boolean; onAdd: () => void }) {
  return <article className="group relative w-36 shrink-0 sm:w-40">
    <div className="relative mb-2 aspect-[4/3] overflow-hidden bg-tile">
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
