import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useItemImage } from '@/hooks/useItemImage'
import { analyzePiece } from '@/hooks/useRetagPieces'
import { COLOUR_PALETTE, colourNameToHex } from '@/lib/colourUtils'
import { categoryFromAnalysis } from '@/lib/scanItem'
import { coloursFromName } from '@/lib/stylist'
import { updateItem as saveItem } from '@/lib/wardrobeService'
import { useWardrobeStore } from '@/store/wardrobeStore'
import type { ClothingCategory, ClothingItem, Pattern } from '@/types'

// Review untagged pieces one at a time: each comes up with suggested tags
// (from photo tagging when it's working, otherwise from the piece's name),
// in plain words anyone can answer. Save keeps them; tapping a chip changes one.

const TYPES: Record<ClothingCategory, string[]> = {
  tops: ['T-shirt', 'Shirt', 'Blouse', 'Polo', 'Tank or cami', 'Crop top', 'Corset', 'Kurti', 'Bodysuit', 'Other top'],
  bottoms: ['Jeans', 'Trousers', 'Sweatpants', 'Leggings', 'Skirt', 'Mini skirt', 'Shorts', 'Cargo pants', 'Palazzo'],
  dresses: ['Mini dress', 'Midi dress', 'Maxi dress', 'Slip dress', 'Shirt dress', 'Bodycon dress'],
  outerwear: ['Sweater', 'Cardigan', 'Hoodie', 'Sweatshirt', 'Jacket', 'Blazer', 'Coat', 'Vest'],
  shoes: ['Sneakers', 'Heels', 'Flats', 'Boots', 'Sandals', 'Loafers', 'Slides'],
  accessories: ['Bag', 'Belt', 'Jewellery', 'Sunglasses', 'Scarf', 'Hat', 'Watch'],
}
const FABRICS = ['Denim', 'Cotton', 'Linen', 'Knit', 'Sweat fabric', 'Silk or satin', 'Chiffon', 'Leather', 'Wool', 'Polyester']
const DRESSY = [
  { label: 'Lounge or gym', formality: 'Casual' },
  { label: 'Everyday', formality: 'Casual' },
  { label: 'Smart casual', formality: 'Smart Casual' },
  { label: 'Work', formality: 'Business' },
  { label: 'Formal or evening', formality: 'Formal' },
]
const FITS = ['Fitted', 'Regular', 'Relaxed', 'Oversized']
const PATTERNS: Array<{ label: string; value: Pattern }> = [
  { label: 'Plain', value: 'solid' }, { label: 'Striped', value: 'striped' }, { label: 'Checked', value: 'checked' },
  { label: 'Floral', value: 'floral' }, { label: 'Animal', value: 'animal-print' }, { label: 'Other print', value: 'abstract' },
]
const CATEGORY_LABEL: Record<ClothingCategory, string> = {
  tops: 'Top', bottoms: 'Bottom', dresses: 'Dress', outerwear: 'Woolen or layer', shoes: 'Shoes', accessories: 'Accessory',
}

interface Answers {
  name: string
  category: ClothingCategory
  type: string | null
  fabric: string | null
  dressy: string | null
  fit: string | null
  pattern: Pattern
  colours: string[]
  highWaist: boolean
}

const find = (options: string[], words: string) => options.find((option) => words.includes(option.toLowerCase().split(' ')[0])) ?? null

/** What the name alone suggests: "Brown Pants" → bottoms, trousers?, brown. */
function guessFromName(item: ClothingItem): Answers {
  const words = item.name.toLowerCase()
  const type = /sweat|jogger|track/.test(words) ? (item.category === 'bottoms' ? 'Sweatpants' : null)
    // A bare "pants" could be anything (jeans, sweatpants), so no guess from it.
    : /jean/.test(words) ? 'Jeans' : /trouser/.test(words) && item.category === 'bottoms' ? 'Trousers' : find(TYPES[item.category], words)
  const fabric = /denim|jean/.test(words) ? 'Denim' : /sweat|jogger|fleece/.test(words) ? 'Sweat fabric' : find(FABRICS, words)
  return {
    name: item.name,
    category: item.category,
    type,
    fabric,
    dressy: type === 'Sweatpants' || type === 'Leggings' ? 'Lounge or gym' : null,
    fit: find(FITS, words),
    pattern: /stripe/.test(words) ? 'striped' : /check|plaid/.test(words) ? 'checked' : /floral|flower/.test(words) ? 'floral' : /print/.test(words) ? 'abstract' : item.pattern,
    colours: item.colour.length ? item.colour : coloursFromName(item.name),
    highWaist: /high.?(waist|rise)/.test(words),
  }
}

/** Fold a photo-tagging result into the answers, as suggestions. */
function fromAnalysis(base: Answers, item: ClothingItem, analysis: Awaited<ReturnType<typeof analyzePiece>>): Answers {
  const category = categoryFromAnalysis(analysis) ?? base.category
  const sub = (analysis.subcategory ?? '').toLowerCase()
  const material = (analysis.material ?? '').toLowerCase()
  const formality = (analysis.formality ?? '').toLowerCase()
  const colours = [analysis.primaryColor, ...(analysis.secondaryColors ?? [])].filter((c): c is string => !!c && COLOUR_PALETTE.some((p) => p.name === c)).slice(0, 2)
  return {
    ...base,
    name: item.name.trim().split(/\s+/).length <= 2 && analysis.name ? analysis.name.slice(0, 100) : base.name,
    category,
    type: find(TYPES[category], sub) ?? (/jean/.test(sub) ? 'Jeans' : /pant|trouser/.test(sub) ? 'Trousers' : base.type),
    fabric: /denim/.test(material) ? 'Denim' : /fleece|jersey|terry/.test(material) ? 'Sweat fabric' : /silk|satin/.test(material) ? 'Silk or satin' : find(FABRICS, material) ?? base.fabric,
    dressy: formality.includes('black tie') || formality === 'formal' ? 'Formal or evening' : formality.includes('business') ? 'Work' : formality.includes('smart') ? 'Smart casual' : formality === 'casual' ? (base.dressy ?? 'Everyday') : base.dressy,
    fit: analysis.fit ? FITS.find((fit) => fit.toLowerCase() === analysis.fit?.toLowerCase()) ?? base.fit : base.fit,
    pattern: (analysis.pattern && PATTERNS.some((p) => p.value === analysis.pattern) ? analysis.pattern : base.pattern) as Pattern,
    colours: base.colours.length ? base.colours : colours,
  }
}

function toPatch(answers: Answers): Partial<ClothingItem> {
  const subcategory = answers.type ? answers.type.toLowerCase().replace(' or cami', '').replace('other top', 'top') : undefined
  const material = answers.fabric === 'Sweat fabric' ? 'fleece jersey' : answers.fabric === 'Silk or satin' ? 'satin' : answers.fabric?.toLowerCase()
  const dressy = DRESSY.find((option) => option.label === answers.dressy)
  return {
    name: answers.name.trim() || 'Piece',
    category: answers.category,
    subcategory,
    material,
    formality: dressy?.formality,
    fit: answers.fit ?? undefined,
    pattern: answers.pattern,
    colour: answers.colours,
    construction: answers.highWaist ? 'high-waisted' : undefined,
    ...(answers.dressy === 'Lounge or gym' ? { occasions: ['casual', 'gym'] as ClothingItem['occasions'] } : {}),
    updatedAt: new Date().toISOString(),
  }
}

export function ReviewPieces({ pieces, onClose }: { pieces: ClothingItem[]; onClose: () => void }) {
  const { user } = useAuth()
  // The list is fixed when it opens, so saving a piece doesn't reshuffle it.
  const queue = useMemo(() => pieces, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0)
  const [saved, setSaved] = useState(0)
  const item = queue[index] ?? null
  const [answers, setAnswers] = useState<Answers | null>(item ? guessFromName(item) : null)
  // Once the person taps something, late photo suggestions don't overwrite it.
  const touchedRef = useRef(false)
  const [suggesting, setSuggesting] = useState(false)
  const imageUrl = useItemImage(item)

  // New piece: start from the name, then let photo tagging fill in what it can.
  useEffect(() => {
    if (!item) return
    const base = guessFromName(item)
    setAnswers(base)
    touchedRef.current = false
    let cancelled = false
    setSuggesting(true)
    analyzePiece(item)
      .then((analysis) => { if (!cancelled) setAnswers((current) => current && !touchedRef.current ? fromAnalysis(current, item, analysis) : current) })
      .catch((error) => console.warn('[review] no photo suggestion', item.id, error instanceof Error ? error.message : error))
      .finally(() => { if (!cancelled) setSuggesting(false) })
    return () => { cancelled = true }
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item || !answers) {
    return createPortal(
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-warm-cream p-6 text-center">
        <div>
          <p className="font-display text-3xl text-text-primary">All done</p>
          <p className="mt-2 text-sm text-text-muted">Reviewed {saved} {saved === 1 ? 'piece' : 'pieces'}. Outfits will use the new details.</p>
          <button type="button" onClick={onClose} className="mt-6 rounded-full bg-text-primary px-6 py-3 text-xs font-medium uppercase tracking-widest text-warm-cream">Back to my Kloset</button>
        </div>
      </div>,
      document.body,
    )
  }

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    touchedRef.current = true
    setAnswers((current) => current && { ...current, [key]: value })
  }
  const toggle = <K extends 'type' | 'fabric' | 'dressy' | 'fit'>(key: K, value: string) => set(key, answers[key] === value ? null : value)
  const next = () => setIndex((current) => current + 1)
  const save = () => {
    const patch = toPatch(answers)
    useWardrobeStore.getState().updateItem(item.id, patch)
    if (user) saveItem(user.id, { ...item, ...patch }).catch((error) => console.error('[review] save failed', item.id, error))
    console.log('[review] saved', item.id)
    setSaved((count) => count + 1)
    next()
  }

  const chip = (label: string, selected: boolean, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick} aria-pressed={selected} className={clsx(
      'rounded-full border px-3.5 py-2 text-sm transition-colors',
      selected ? 'border-dark-purple bg-dark-purple text-butter-yellow' : 'border-text-primary/15 bg-surface text-text-primary hover:border-text-primary/40',
    )}>{label}</button>
  )
  const section = (title: string, children: React.ReactNode) => (
    <div className="mt-6">
      <p className="mb-2 text-2xs uppercase tracking-widest text-text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Review pieces" className="fixed inset-0 z-[70] flex flex-col bg-warm-cream lg:flex-row">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 ring-1 ring-text-primary/10 text-text-primary">
        <X size={18} strokeWidth={1.5} />
      </button>

      <div className="flex h-[38vh] shrink-0 items-center justify-center bg-tile p-4 lg:h-auto lg:flex-1">
        {imageUrl ? <img src={imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" /> : <p className="text-sm text-text-muted">No photo</p>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:w-[480px] lg:flex-none">
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-8 lg:pt-16">
          <p className="text-2xs uppercase tracking-widest text-text-muted">Piece {index + 1} of {queue.length}</p>
          <input
            value={answers.name}
            onChange={(event) => set('name', event.target.value)}
            aria-label="Name"
            className="mt-2 w-full border-b border-text-primary/20 bg-transparent pb-1 font-display text-3xl text-text-primary focus:border-text-primary focus:outline-none"
          />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
            <Sparkles size={12} /> {suggesting ? 'Reading the photo for suggestions…' : 'Suggested tags are filled in. Tap to change any.'}
          </p>

          {section('What is it?', <>
            {(Object.keys(TYPES) as ClothingCategory[]).map((category) => chip(CATEGORY_LABEL[category], answers.category === category, () => { set('category', category); set('type', null) }))}
          </>)}
          {section('Type', TYPES[answers.category].map((type) => chip(type, answers.type === type, () => toggle('type', type))))}
          {answers.category !== 'shoes' && answers.category !== 'accessories' && section('Fabric', FABRICS.map((fabric) => chip(fabric, answers.fabric === fabric, () => toggle('fabric', fabric))))}
          {section('How dressy is it?', DRESSY.map((option) => chip(option.label, answers.dressy === option.label, () => toggle('dressy', option.label))))}
          {['tops', 'bottoms', 'dresses', 'outerwear'].includes(answers.category) && section('Fit', <>
            {FITS.map((fit) => chip(fit, answers.fit === fit, () => toggle('fit', fit)))}
            {answers.category === 'bottoms' && chip('High-waisted', answers.highWaist, () => set('highWaist', !answers.highWaist))}
          </>)}
          {section('Pattern', PATTERNS.map((pattern) => chip(pattern.label, answers.pattern === pattern.value, () => set('pattern', pattern.value))))}
          {section('Colour (up to 2)', COLOUR_PALETTE.map((colour) => (
            <button
              key={colour.name}
              type="button"
              title={colour.name}
              aria-label={colour.name}
              aria-pressed={answers.colours.includes(colour.name)}
              onClick={() => set('colours', answers.colours.includes(colour.name) ? answers.colours.filter((c) => c !== colour.name) : [...answers.colours, colour.name].slice(-2))}
              className={clsx('h-8 w-8 rounded-full ring-offset-2 ring-offset-warm-cream transition', answers.colours.includes(colour.name) ? 'ring-2 ring-text-primary' : 'ring-1 ring-text-primary/15')}
              style={{ backgroundColor: colourNameToHex(colour.name) }}
            />
          )))}
          {answers.colours.length > 0 && <p className="mt-2 text-xs text-text-muted">{answers.colours.join(' and ')}</p>}
        </div>

        <div className="flex gap-3 border-t border-text-primary/10 px-5 py-4 sm:px-8">
          <button type="button" onClick={next} className="h-12 flex-1 rounded-full border border-text-primary/20 text-xs font-medium uppercase tracking-widest text-text-primary">Skip</button>
          <button type="button" onClick={save} className="h-12 flex-[2] rounded-full bg-text-primary text-xs font-medium uppercase tracking-widest text-warm-cream">Save{index + 1 < queue.length ? ' and next' : ''}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
