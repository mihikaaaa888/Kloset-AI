import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { ArrowLeft, ImagePlus, Shirt } from 'lucide-react'
import { ShopItemCard } from '@/components/shop/ShopItemCard'
import { useItemImage } from '@/hooks/useItemImage'
import { compressImage } from '@/lib/imageStorage'
import { analyzeImage } from '@/lib/analyzeImage'
import { recommendForPiece, type BudgetId, type PieceAnchor } from '@/lib/shopping'
import type { CatalogItem, ClothingCategory, ClothingItem, UserProfile } from '@/types'

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: 'Tops', bottoms: 'Bottoms', dresses: 'Dresses', outerwear: 'Outerwear', shoes: 'Shoes', accessories: 'Accessories',
}
const GROUP_HEADINGS: Record<ClothingCategory, string> = {
  tops: 'Tops to wear with it', bottoms: 'Bottoms to pair', dresses: 'Dresses to pair', outerwear: 'Layer it with',
  shoes: 'Finish with shoes', accessories: 'Accessorise',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS) as ClothingCategory[]

type Picked =
  | { kind: 'kloset'; item: ClothingItem }
  | { kind: 'upload'; previewUrl: string; anchor: PieceAnchor }

interface CompleteAPieceProps {
  budget: BudgetId
  profile: UserProfile | null
  wardrobe: ClothingItem[]
  isInWardrobe: (catalogId: string) => boolean
  onAdd: (item: CatalogItem) => void
}

const anchorFromItem = (item: ClothingItem): PieceAnchor => ({
  name: item.name,
  category: item.category,
  colours: item.colour,
  occasions: item.occasions,
  formality: item.formality,
})

/** "Complete a piece" — pick something you own (or upload a photo) and get pieces to buy around it. */
export function CompleteAPiece({ budget, profile, wardrobe, isInWardrobe, onAdd }: CompleteAPieceProps) {
  const [source, setSource] = useState<'kloset' | 'upload'>(wardrobe.length ? 'kloset' : 'upload')
  const [picked, setPicked] = useState<Picked | null>(null)

  const anchor = useMemo(
    () => (picked ? (picked.kind === 'kloset' ? anchorFromItem(picked.item) : picked.anchor) : null),
    [picked]
  )
  const groups = useMemo(() => (anchor ? recommendForPiece(anchor, budget, profile) : []), [anchor, budget, profile])

  // Free the uploaded preview's object URL when it's replaced or on unmount.
  useEffect(() => {
    if (picked?.kind !== 'upload') return
    const url = picked.previewUrl
    return () => URL.revokeObjectURL(url)
  }, [picked])

  // ── Step 2: recommendations around the chosen piece ──
  if (picked && anchor) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <aside className="lg:col-span-3 lg:sticky lg:top-28">
          <button onClick={() => setPicked(null)} className="text-tab mb-5">
            <ArrowLeft size={13} /> Change piece
          </button>
          <div className="aspect-[3/4] bg-cream-200 overflow-hidden max-w-xs">
            {picked.kind === 'kloset' ? (
              <KlosetItemImage item={picked.item} />
            ) : (
              <img src={picked.previewUrl} alt={anchor.name} className="w-full h-full object-cover" />
            )}
          </div>
          <p className="text-2xs uppercase tracking-widest text-text-muted mt-4">Completing</p>
          <p className="font-display text-2xl text-text-primary leading-tight mt-1">{anchor.name}</p>
          {anchor.colours.length > 0 && (
            <p className="text-xs text-text-muted mt-1">{anchor.colours.join(' · ')}</p>
          )}
        </aside>

        <div className="lg:col-span-9 space-y-14">
          {groups.length === 0 ? (
            <p className="py-16 text-center font-display text-2xl text-text-primary">Nothing in this budget yet — try a wider one.</p>
          ) : (
            groups.map((group) => (
              <section key={group.category}>
                <h3 className="font-display text-2xl font-medium text-text-primary mb-5">{GROUP_HEADINGS[group.category]}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-10">
                  {group.items.map((item) => (
                    <ShopItemCard key={item.id} item={item} mode="buy" inWardrobe={isInWardrobe(item.id)} onAdd={() => onAdd(item)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Step 1: choose the piece ──
  return (
    <div>
      <div className="flex justify-center gap-10 mb-10">
        {(['kloset', 'upload'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={clsx('text-tab sm:text-sm', source === s && 'text-tab-active')}
          >
            {s === 'kloset' ? 'From my Kloset' : 'Upload a photo'}
          </button>
        ))}
      </div>

      {source === 'kloset' ? (
        wardrobe.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-2xl text-text-primary mb-3">Your Kloset is empty</p>
            <button onClick={() => setSource('upload')} className="text-tab text-tab-active">Upload a photo instead</button>
          </div>
        ) : (
          <>
            <p className="text-center text-sm text-text-muted mb-6">Pick the piece you want to build around.</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-6">
              {wardrobe.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    console.log('[complete-a-piece] picked from Kloset', item.id)
                    setPicked({ kind: 'kloset', item })
                  }}
                  className="group text-left"
                >
                  <div className="aspect-[3/4] bg-cream-200 overflow-hidden">
                    <KlosetItemImage item={item} />
                  </div>
                  <p className="text-xs text-text-primary mt-2 truncate group-hover:underline underline-offset-4">{item.name}</p>
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        <PhotoUpload onReady={(previewUrl, anchor) => setPicked({ kind: 'upload', previewUrl, anchor })} />
      )}
    </div>
  )
}

function KlosetItemImage({ item }: { item: ClothingItem }) {
  const url = useItemImage(item)
  return url ? (
    <img src={url} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
  ) : (
    <div className="w-full h-full flex items-center justify-center">
      <Shirt size={28} className="text-text-primary/25" />
    </div>
  )
}

// ─── Upload a photo ───────────────────────────────────────────────────────────
// The photo is read by the same AI analysis as Add Item. If that can't tell
// what the piece is (no API key, unclear photo), the user just picks the
// category themselves — recommendations still work from that alone.

function PhotoUpload({ onReady }: { onReady: (previewUrl: string, anchor: PieceAnchor) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'need-category' | 'error'>('idle')
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('That file isn’t an image.')
      setStatus('error')
      return
    }
    setStatus('reading')
    setError('')
    try {
      const blob = await compressImage(file)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      console.log('[complete-a-piece] analysing upload')
      const analysis = await analyzeImage(blob).catch((err) => {
        console.error('[complete-a-piece] analysis failed', err)
        return null
      })
      const category = analysis?.category as ClothingCategory | undefined
      if (analysis && category && CATEGORIES.includes(category)) {
        console.log('[complete-a-piece] upload read as', category, analysis.name)
        onReady(url, {
          name: analysis.name ?? `Your ${CATEGORY_LABELS[category].toLowerCase()}`,
          category,
          colours: [analysis.primaryColor, ...(analysis.secondaryColors ?? [])].filter(Boolean) as string[],
          occasions: analysis.occasions ?? [],
          formality: analysis.formality,
        })
      } else {
        console.log('[complete-a-piece] could not read category, asking user')
        setStatus('need-category')
      }
    } catch (err) {
      console.error('[complete-a-piece] upload failed', err)
      setError(err instanceof Error ? err.message : 'Couldn’t read that photo.')
      setStatus('error')
    }
  }

  if (status === 'need-category' && previewUrl) {
    return (
      <div className="flex flex-col items-center text-center">
        <img src={previewUrl} alt="Your upload" className="w-40 aspect-[3/4] object-cover mb-6" />
        <p className="font-display text-2xl text-text-primary mb-5">What is this piece?</p>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => onReady(previewUrl, { name: `Your ${CATEGORY_LABELS[c].toLowerCase()}`, category: c, colours: [], occasions: [] })}
              className="text-tab sm:text-sm"
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        disabled={status === 'reading'}
        className={clsx(
          'w-full aspect-[4/3] flex flex-col items-center justify-center gap-3 border border-dashed transition-colors',
          dragging ? 'border-butter-yellow bg-butter-yellow/5' : 'border-text-primary/25 hover:border-text-primary/50'
        )}
      >
        {status === 'reading' ? (
          <>
            <div className="w-6 h-6 rounded-full border-2 border-butter-yellow/30 border-t-butter-yellow animate-spin" />
            <span className="text-2xs uppercase tracking-widest text-text-muted">Reading your piece…</span>
          </>
        ) : (
          <>
            <ImagePlus size={28} className="text-text-primary/40" />
            <span className="text-xs uppercase tracking-widest text-text-primary">Upload a photo of the piece</span>
            <span className="text-2xs text-text-muted">or drag it here</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
      {status === 'error' && <p className="text-sm text-red-700 dark:text-red-400 text-center mt-4">{error}</p>}
    </div>
  )
}
