import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, ImagePlus, X, ChevronRight, SkipForward, Link, Search, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { SelectChip } from '@/components/ui/SelectChip'
import { ColourSwatch } from '@/components/ui/ColourSwatch'
import { COLOUR_PALETTE } from '@/lib/colourUtils'
import { apiUrl } from '@/lib/apiUrl'
import {
  saveImage,
  getImage,
  deleteImage,
  validateImageFile,
  compressImage,
} from '@/lib/imageStorage'
import { getPhotoUrl } from '@/lib/wardrobeService'
import { analyzeImage, analyzeImageFromUrl } from '@/lib/analyzeImage'
import { refineGarmentImage, removeImageBackground } from '@/lib/backgroundRemoval'
import { parseOutfitPhoto } from '@/lib/fashionParsing'
import type { ClothingAnalysis } from '@/lib/analyzeImage'
import type { ClothingItem, ClothingCategory, Pattern, Season, Occasion } from '@/types'

// ─── Analysis helpers ─────────────────────────────────────────────────────────

const VALID_COLOURS = new Set(COLOUR_PALETTE.map((c) => c.name))
const VALID_CATEGORIES = new Set(['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'])
const VALID_PATTERNS = new Set(['solid', 'striped', 'checked', 'floral', 'abstract', 'animal-print', 'geometric', 'other'])
const VALID_SEASONS = new Set(['spring', 'summer', 'autumn', 'winter', 'all-season'])
const VALID_OCCASIONS = new Set(['work', 'casual', 'formal', 'date-night', 'weekend', 'travel', 'gym', 'special-event'])
const FIT_MAP: Record<string, string> = { slim: 'Slim', regular: 'Regular', relaxed: 'Relaxed', oversized: 'Oversized', fitted: 'Fitted' }
const FORMALITY_MAP: Record<string, string> = { casual: 'Casual', 'smart casual': 'Smart Casual', business: 'Business', formal: 'Formal', 'black tie': 'Black Tie' }

// ─── Options ──────────────────────────────────────────────────────────────────

const CATEGORIES: { value: ClothingCategory; label: string }[] = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]

const SUBCATEGORIES: Partial<Record<ClothingCategory, string[]>> = {
  tops: ['T-shirt', 'Shirt', 'Blouse', 'Tank Top', 'Polo', 'Crop Top', 'Hoodie', 'Sweatshirt'],
  bottoms: ['Jeans', 'Trousers', 'Shorts', 'Skirt', 'Leggings', 'Joggers'],
  dresses: ['Casual Dress', 'Midi Dress', 'Maxi Dress', 'Mini Dress', 'Wrap Dress', 'Sundress'],
  outerwear: ['Blazer', 'Jacket', 'Coat', 'Cardigan', 'Puffer', 'Raincoat', 'Leather Jacket'],
  shoes: ['Sneakers', 'Boots', 'Heels', 'Loafers', 'Sandals', 'Flats', 'Mules'],
  accessories: ['Bag', 'Jewellery', 'Belt', 'Hat', 'Scarf', 'Watch', 'Sunglasses'],
}

const FIT_OPTIONS = ['Slim', 'Regular', 'Relaxed', 'Oversized', 'Fitted']

const FORMALITY_OPTIONS = ['Casual', 'Smart Casual', 'Business', 'Formal', 'Black Tie']

const PATTERNS: { value: Pattern; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'striped', label: 'Striped' },
  { value: 'checked', label: 'Checked' },
  { value: 'floral', label: 'Floral' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'animal-print', label: 'Animal Print' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'other', label: 'Other' },
]

const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'autumn', label: 'Autumn' },
  { value: 'winter', label: 'Winter' },
  { value: 'all-season', label: 'All Season' },
]

const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: 'work', label: 'Work' },
  { value: 'casual', label: 'Casual' },
  { value: 'formal', label: 'Formal' },
  { value: 'date-night', label: 'Date Night' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'travel', label: 'Travel' },
  { value: 'gym', label: 'Gym' },
  { value: 'special-event', label: 'Special Event' },
]

// ─── Draft ────────────────────────────────────────────────────────────────────

interface ItemDraft {
  name: string
  category: ClothingCategory | ''
  subcategory: string
  colour: string[]
  material: string
  pattern: Pattern | ''
  fit: string
  formality: string
  seasons: Season[]
  occasions: Occasion[]
  brand: string
  notes: string
}

function blankDraft(): ItemDraft {
  return {
    name: '',
    category: '',
    subcategory: '',
    colour: [],
    material: '',
    pattern: 'solid',
    fit: '',
    formality: '',
    seasons: [],
    occasions: [],
    brand: '',
    notes: '',
  }
}

function itemToDraft(item: ClothingItem): ItemDraft {
  return {
    name: item.name,
    category: item.category,
    subcategory: item.subcategory ?? '',
    colour: item.colour,
    material: item.material ?? '',
    pattern: item.pattern,
    fit: item.fit ?? '',
    formality: item.formality ?? '',
    seasons: item.seasons,
    occasions: item.occasions,
    brand: item.brand ?? '',
    notes: item.notes ?? '',
  }
}

// ─── Image state ──────────────────────────────────────────────────────────────

interface QueuedImage {
  imageId: string
  previewUrl: string
  blob: Blob
  detectedCategory?: ClothingCategory
  detectedName?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AddItemModalProps {
  open: boolean
  onClose: () => void
  onSave: (item: ClothingItem) => void
  editItem?: ClothingItem
}

export function AddItemModal({ open, onClose, onSave, editItem }: AddItemModalProps) {
  const [draft, setDraft] = useState<ItemDraft>(() =>
    editItem ? itemToDraft(editItem) : blankDraft()
  )
  const [errors, setErrors] = useState<Partial<Record<keyof ItemDraft, string>>>({})

  // ── Image state ──────────────────────────────────────────────────────────────
  // activeImageId: the imageId to persist in ClothingItem (IndexedDB key)
  const [activeImageId, setActiveImageId] = useState<string | null>(null)
  // legacyImageUrl: base64/remote imageUrl from an old item, preserved if not replaced
  const [legacyImageUrl, setLegacyImageUrl] = useState<string | null>(null)
  // previewUrl: displayed in the modal (blob URL or base64)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [imageProcessingStep, setImageProcessingStep] = useState('')
  const [imageError, setImageError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // AI analysis state
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiApplied, setAiApplied] = useState(false)

  // Photo tab state
  const [photoTab, setPhotoTab] = useState<'upload' | 'url' | 'browse'>('upload')
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)

  // Multi-upload batch (new items only)
  const [uploadBatch, setUploadBatch] = useState<QueuedImage[]>([])
  const [batchIdx, setBatchIdx] = useState(0)
  const isInBatch = uploadBatch.length > 1

  // Refs for cleanup (using refs so closures always see current values)
  const pendingMap = useRef(new Map<string, string>()) // imageId → previewUrl (uploaded, not saved)
  const priorImageId = useRef<string | null>(null)     // old imageId to delete when saving
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Reset when modal opens ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setDraft(editItem ? itemToDraft(editItem) : blankDraft())
    setErrors({})
    setImageError(null)
    setUploadBatch([])
    setBatchIdx(0)
    setActiveImageId(editItem?.imageId ?? null)
    setLegacyImageUrl(editItem?.imageUrl ?? null)
    setPreviewUrl(editItem?.imageUrl ?? null)
    setAiAnalyzing(false)
    setAiApplied(false)
    setPhotoTab('upload')
    setUrlInput('')
    setUrlError(null)
    setUrlLoading(false)

    pendingMap.current = new Map()
    priorImageId.current = null
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load existing IndexedDB image for edit mode ──────────────────────────────
  useEffect(() => {
    if (!open || !editItem?.imageId || editItem.imageUrl) return
    let cancelled = false

    getImage(editItem.imageId).then(async (blob) => {
      if (cancelled) return
      if (blob) { setPreviewUrl(URL.createObjectURL(blob)); return }
      // Photo taken on another device
      const remote = editItem.imageStoragePath ? await getPhotoUrl(editItem.imageStoragePath) : null
      if (!cancelled && remote) setPreviewUrl(remote)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [open, editItem?.imageId, editItem?.imageUrl, editItem?.imageStoragePath])

  // ── Process selected files ───────────────────────────────────────────────────
  const processFiles = useCallback(async (files: File[]) => {
    setImageProcessing(true)
    setImageProcessingStep('Preparing photo…')
    setImageError(null)

    const valid: File[] = []
    const errs: string[] = []
    for (const f of files) {
      const err = validateImageFile(f)
      if (err) errs.push(`${f.name}: ${err}`)
      else valid.push(f)
    }

    if (valid.length === 0) {
      setImageError(errs[0] ?? 'No valid images selected.')
      setImageProcessing(false)
      return
    }

    try {
      const processed: QueuedImage[] = []
      for (const file of valid) {
        setImageProcessingStep('Loading the on-device clothing scanner…')
        const compressed = await compressImage(file)
        const parsed = await parseOutfitPhoto(compressed)
        if (parsed.containsPerson && parsed.garments.length === 0) {
          throw new Error('We couldn’t safely isolate clothing from this photo. Try a clearer, full-body image; the original photo was not saved or analyzed.')
        }
        let pieces: Array<{ blob: Blob; category?: ClothingCategory; name?: string }> = parsed.garments.length > 0
          ? parsed.garments
          : [{ blob: await removeImageBackground(parsed.safeFallback).catch(() => parsed.safeFallback), category: undefined, name: undefined }]
        if (editItem && pieces.length > 1) {
          pieces = [pieces.find((piece) => piece.category === editItem.category) ?? pieces[0]]
        }
        for (const piece of pieces) {
          setImageProcessingStep('Refining garment edges…')
          const refinedBlob = parsed.garments.length > 0
            ? await refineGarmentImage(piece.blob) ?? piece.blob
            : piece.blob
          setImageProcessingStep('Saving garment…')
          const imageId = await saveImage(refinedBlob)
          const url = URL.createObjectURL(refinedBlob)
          processed.push({ imageId, previewUrl: url, blob: refinedBlob, detectedCategory: piece.category, detectedName: piece.name })
          pendingMap.current.set(imageId, url)
        }
      }

      // If there was already a pending (just-uploaded, not from editItem) image, clean it up
      if (activeImageId && pendingMap.current.has(activeImageId)) {
        deleteImage(activeImageId).catch(() => {})
        URL.revokeObjectURL(pendingMap.current.get(activeImageId)!)
        pendingMap.current.delete(activeImageId)
      }

      // Record the original imageId for deletion when saving in edit mode
      if (editItem?.imageId && !priorImageId.current) {
        priorImageId.current = editItem.imageId
      }

      // Set first image as active
      const first = processed[0]
      setActiveImageId(first.imageId)
      setPreviewUrl(first.previewUrl)
      setLegacyImageUrl(null)
      setDraft({ ...blankDraft(), category: first.detectedCategory ?? '', name: first.detectedName ?? '' })

      setUploadBatch(processed.length > 1 ? processed : [])
      setBatchIdx(0)

      if (errs.length > 0) {
        setImageError(`${errs.length} file(s) skipped — unsupported format or too large.`)
      }

      // Trigger AI analysis on the first image (only for new items, not edits)
      if (!editItem) {
        runAiAnalysis(first.blob, first.detectedCategory, first.detectedName)
      }
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Failed to process image.')
    } finally {
      setImageProcessing(false)
      setImageProcessingStep('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [activeImageId, editItem?.imageId, editItem?.category]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI analysis ──────────────────────────────────────────────────────────────
  const applyAnalysis = useCallback((analysis: ClothingAnalysis, detectedCategory?: ClothingCategory, detectedName?: string) => {
    setDraft((prev) => {
      const next = { ...prev }

      // Only fill the name if the user hasn't already typed one — everything
      // else is safe to overwrite since analysis runs immediately on upload,
      // before there's normally anything to type over.
      if (analysis.name && (!prev.name.trim() || (detectedName && prev.name === detectedName))) next.name = analysis.name
      else if (detectedName && !prev.name.trim()) next.name = detectedName

      if (detectedCategory) {
        next.category = detectedCategory === 'tops' && analysis.category === 'outerwear'
          ? 'outerwear'
          : detectedCategory
        next.subcategory = analysis.subcategory || (detectedName && !['Top', 'Pants', 'Shoes'].includes(detectedName) ? detectedName : '')
      } else if (analysis.category && VALID_CATEGORIES.has(analysis.category)) {
        next.category = analysis.category as ClothingCategory
        next.subcategory = ''
      }
      if (analysis.subcategory) next.subcategory = analysis.subcategory

      const colours = [analysis.primaryColor, ...(analysis.secondaryColors ?? [])]
        .filter((c): c is string => !!c && VALID_COLOURS.has(c))
        .slice(0, 4)
      if (colours.length > 0) next.colour = colours

      if (analysis.material) next.material = analysis.material

      if (analysis.pattern && VALID_PATTERNS.has(analysis.pattern)) {
        next.pattern = analysis.pattern as Pattern
      }

      const fit = analysis.fit ? FIT_MAP[analysis.fit.toLowerCase()] : undefined
      if (fit) next.fit = fit

      const formality = analysis.formality
        ? FORMALITY_MAP[analysis.formality.toLowerCase()]
        : undefined
      if (formality) next.formality = formality

      const seasons = (analysis.seasons ?? []).filter((s) => VALID_SEASONS.has(s)) as Season[]
      if (seasons.length > 0) next.seasons = seasons

      const occasions = (analysis.occasions ?? []).filter((o) => VALID_OCCASIONS.has(o)) as Occasion[]
      if (occasions.length > 0) next.occasions = occasions

      return next
    })
  }, [])

  const runAiAnalysis = useCallback(async (blob: Blob, detectedCategory?: ClothingCategory, detectedName?: string) => {
    setAiAnalyzing(true)
    setAiApplied(false)
    try {
      const analysis = await analyzeImage(blob)
      if (analysis) {
        applyAnalysis(analysis, detectedCategory, detectedName)
        setAiApplied(true)
      }
    } catch {
      // silent — user fills manually
    } finally {
      setAiAnalyzing(false)
    }
  }, [applyAnalysis])

  // Same auto-detect, for images picked via URL or Pexels browse — those
  // never had a local Blob to hand to runAiAnalysis, so the server fetches
  // the URL itself (see analyzeImageFromUrl).
  const runAiAnalysisFromUrl = useCallback(async (url: string) => {
    setAiAnalyzing(true)
    setAiApplied(false)
    try {
      const analysis = await analyzeImageFromUrl(url)
      if (analysis) {
        applyAnalysis(analysis)
        setAiApplied(true)
      }
    } catch {
      // silent — user fills manually
    } finally {
      setAiAnalyzing(false)
    }
  }, [applyAnalysis])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) processFiles(files)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) processFiles(files)
  }

  const handleRemoveImage = () => {
    // Track original imageId for deletion if user removes image in edit mode
    if (editItem?.imageId && !priorImageId.current) {
      priorImageId.current = editItem.imageId
    }
    // Note: pendingMap entries stay until modal closes — they'll be cleaned up there
    setActiveImageId(null)
    setLegacyImageUrl(null)
    setPreviewUrl(null)
  }

  // ── Load image from URL ──────────────────────────────────────────────────────
  const handleUrlSubmit = useCallback(() => {
    const url = urlInput.trim()
    if (!url) return
    try { new URL(url) } catch {
      setUrlError('Please enter a valid URL.')
      return
    }
    setUrlError(null)
    setUrlLoading(true)
    const img = new Image()
    // No crossOrigin here — we only need to display the image, not read pixels.
    // Setting crossOrigin would block most fashion/retail sites that don't send CORS headers.
    img.onload = () => {
      setUrlLoading(false)
      setPreviewUrl(url)
      setLegacyImageUrl(url)
      setActiveImageId(null)
      if (!editItem) runAiAnalysisFromUrl(url)
    }
    img.onerror = () => {
      setUrlLoading(false)
      setUrlError("Couldn't load that image. Make sure the URL points directly to an image file (right-click a photo → Copy image address).")
    }
    img.src = url
  }, [urlInput, editItem, runAiAnalysisFromUrl])

  // ── Cleanup on close ─────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    // Delete all uploaded-but-not-saved images from IndexedDB
    for (const [id, url] of pendingMap.current) {
      deleteImage(id).catch(() => {})
      URL.revokeObjectURL(url)
    }
    pendingMap.current = new Map()

    // Revoke any edit-mode blob URL that wasn't tracked in pendingMap
    if (previewUrl && previewUrl.startsWith('blob:') && !pendingMap.current.has(activeImageId ?? '')) {
      URL.revokeObjectURL(previewUrl)
    }

    setUploadBatch([])
    setBatchIdx(0)
    setActiveImageId(null)
    setLegacyImageUrl(null)
    setPreviewUrl(null)
    setImageError(null)
    priorImageId.current = null

    onClose()
  }, [onClose, previewUrl, activeImageId])

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const update = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const toggleArray = <T,>(key: keyof ItemDraft, value: T) => {
    setDraft((d) => {
      const arr = d[key] as T[]
      return {
        ...d,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      }
    })
  }

  const validate = (): boolean => {
    const newErrors: typeof errors = {}
    if (!draft.name.trim()) newErrors.name = 'Name is required'
    if (!draft.category) newErrors.category = 'Please select a category'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!validate()) return
    const now = new Date().toISOString()

    // Delete replaced image in edit mode
    if (priorImageId.current) {
      deleteImage(priorImageId.current).catch(() => {})
      priorImageId.current = null
    }

    // Remove the saved imageId from pending cleanup
    if (activeImageId) {
      pendingMap.current.delete(activeImageId)
    }

    // Determine image fields
    const imageFields: Pick<ClothingItem, 'imageId' | 'imageUrl' | 'imageSource'> = activeImageId
      ? {
          imageId: activeImageId,
          // Same photo as before: keep the small cross-device copy, if the row has one.
          imageUrl: activeImageId === editItem?.imageId ? editItem.imageUrl : null,
          imageSource: 'local',
        }
      : legacyImageUrl
      ? { imageId: undefined, imageUrl: legacyImageUrl, imageSource: legacyImageUrl.startsWith('http') ? 'remote' : 'local' }
      : { imageId: undefined, imageUrl: null, imageSource: 'none' }

    const item: ClothingItem = {
      ...(editItem ?? {
        id: crypto.randomUUID(),
        isFavourite: false,
        timesWorn: 0,
        createdAt: now,
      }),
      name: draft.name.trim(),
      category: draft.category as ClothingCategory,
      subcategory: draft.subcategory || undefined,
      ...imageFields,
      colour: draft.colour,
      material: draft.material.trim() || undefined,
      pattern: (draft.pattern as Pattern) || 'solid',
      fit: draft.fit || undefined,
      formality: draft.formality || undefined,
      seasons: draft.seasons,
      occasions: draft.occasions,
      brand: draft.brand.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      updatedAt: now,
    }

    onSave(item)

    // Advance through batch or close
    const nextIdx = batchIdx + 1
    if (isInBatch && nextIdx < uploadBatch.length) {
      const next = uploadBatch[nextIdx]
      setBatchIdx(nextIdx)
      setActiveImageId(next.imageId)
      setPreviewUrl(next.previewUrl)
      setLegacyImageUrl(null)
      priorImageId.current = null
      setDraft(blankDraft())
      setErrors({})
      setImageError(null)
      setAiApplied(false)
      runAiAnalysis(next.blob, next.detectedCategory, next.detectedName)
    } else {
      handleClose()
    }
  }

  // ── Skip in batch ────────────────────────────────────────────────────────────
  const handleSkip = () => {
    if (!isInBatch || batchIdx >= uploadBatch.length) return
    const current = uploadBatch[batchIdx]
    if (current) {
      deleteImage(current.imageId).catch(() => {})
      URL.revokeObjectURL(current.previewUrl)
      pendingMap.current.delete(current.imageId)
    }

    const nextIdx = batchIdx + 1
    if (nextIdx < uploadBatch.length) {
      const next = uploadBatch[nextIdx]
      setBatchIdx(nextIdx)
      setActiveImageId(next.imageId)
      setPreviewUrl(next.previewUrl)
      setDraft(blankDraft())
      setErrors({})
      setImageError(null)
      setAiApplied(false)
      runAiAnalysis(next.blob, next.detectedCategory, next.detectedName)
    } else {
      handleClose()
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const subcategoryOptions = draft.category ? SUBCATEGORIES[draft.category as ClothingCategory] : undefined

  const batchLabel = isInBatch
    ? `Garment ${batchIdx + 1} of ${uploadBatch.length}`
    : null

  const displayUrl = previewUrl

  const actionFooter = (
    <div className="flex gap-3">
      <Button variant="ghost" onClick={handleClose} className="flex-none">
        Cancel
      </Button>
      <Button onClick={handleSave} className="flex-1 gap-1.5 whitespace-nowrap">
        {isInBatch ? (
          <>
            Add to Kloset
            <ChevronRight size={14} />
          </>
        ) : editItem ? (
          'Save Changes'
        ) : (
          'Add to Kloset'
        )}
      </Button>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        batchLabel
          ? `Add to My Kloset — ${batchLabel}`
          : editItem
          ? 'Edit Item'
          : 'Add to My Kloset'
      }
      variant="sheet"
      footer={actionFooter}
    >
      <div className="px-6 py-4 pb-10 space-y-7">

        {/* ── Batch progress bar ── */}
        {isInBatch && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">{batchLabel}</span>
              <button
                onClick={handleSkip}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                <SkipForward size={12} />
                Skip this photo
              </button>
            </div>
            <div className="h-1 rounded-full bg-text-primary/10 overflow-hidden">
              <div
                className="h-full bg-dark-purple rounded-full transition-all duration-300"
                style={{ width: `${((batchIdx + 1) / uploadBatch.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Image Upload ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-text-primary">Photo</p>
            {!displayUrl && (
              <div className="flex gap-5">
                {(
                  [
                    { key: 'upload', icon: <Upload size={11} />, label: 'Upload' },
                    { key: 'browse', icon: <Search size={11} />, label: 'Browse' },
                    { key: 'url',    icon: <Link size={11} />,   label: 'URL' },
                  ] as const
                ).map(({ key, icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setPhotoTab(key); setUrlError(null); setImageError(null) }}
                    className={clsx('text-tab', photoTab === key && 'text-tab-active')}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {imageError && (
            <p className="text-xs text-amber-600 mb-2 bg-amber-50 px-3 py-2 rounded-xl">
              {imageError}
            </p>
          )}

          {displayUrl ? (
            <div className={`relative rounded-2xl overflow-hidden aspect-[4/3] ${isInBatch ? 'max-h-[25vh]' : 'max-h-[40vh]'}`}>
              <img
                src={displayUrl}
                alt="Item preview"
                className="w-full h-full object-cover"
              />

              {/* AI analysing overlay */}
              {aiAnalyzing && (
                <div className="absolute inset-0 bg-scrim/30 backdrop-blur-sm flex items-center justify-center">
                  <div className="bg-surface/95 rounded-2xl px-4 py-3 flex items-center gap-2.5 shadow-soft">
                    <div className="w-4 h-4 rounded-full border-2 border-butter-yellow/20 border-t-butter-yellow animate-spin" />
                    <span className="text-xs font-medium text-text-primary">Analysing…</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleRemoveImage}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-scrim/70 flex items-center justify-center text-white hover:bg-scrim transition-colors"
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
              {!isInBatch && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/90 backdrop-blur-sm text-text-primary text-xs font-medium hover:bg-surface transition-colors"
                >
                  <Upload size={11} />
                  Replace
                </button>
              )}
            </div>
          ) : photoTab === 'browse' ? (
            <ImageSearchBrowser
              defaultQuery={[draft.subcategory, draft.category, 'clothing'].filter(Boolean).join(' ')}
              onSelect={(url) => {
                setPreviewUrl(url)
                setLegacyImageUrl(url)
                setActiveImageId(null)
                if (!editItem) runAiAnalysisFromUrl(url)
              }}
            />
          ) : photoTab === 'url' ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setUrlError(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  placeholder="Paste an image URL from the web…"
                  className="flex-1 px-4 py-3 rounded-xl border border-text-primary/20 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary/50 bg-surface"
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  disabled={urlLoading || !urlInput.trim()}
                  className="px-4 py-3 rounded-xl bg-dark-purple text-butter-yellow text-sm font-medium hover:bg-deep-purple transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {urlLoading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-butter-yellow/40 border-t-butter-yellow animate-spin" />
                  ) : 'Load'}
                </button>
              </div>
              {urlError && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">{urlError}</p>
              )}
              <p className="text-xs text-text-muted">
                Paste a direct image link — right-click any clothing photo online and choose "Copy image address".
              </p>
            </div>
          ) : (
            <div
              onClick={() => !imageProcessing && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={clsx(
                'rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-10 transition-all duration-200',
                imageProcessing ? 'cursor-wait opacity-60' : 'cursor-pointer',
                dragOver
                  ? 'border-dark-purple bg-text-primary/5'
                  : 'border-text-primary/20 hover:border-text-primary/40 hover:bg-text-primary/3'
              )}
            >
              {imageProcessing ? (
                <>
                  <div className="w-8 h-8 rounded-full border-2 border-text-primary/40 border-t-dark-purple animate-spin" />
                  <p className="text-sm text-text-muted">{imageProcessingStep || 'Processing…'}</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-text-primary/8 flex items-center justify-center text-text-primary/50">
                    <ImagePlus size={22} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">Upload a photo</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Tap to browse or drag & drop
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Upload size={12} />
                    <span>JPG, PNG, WEBP · max 15 MB</span>
                  </div>
                </>
              )}
            </div>
          )}

          {!displayUrl && photoTab === 'upload' && !imageProcessing && (
            <p className="text-xs text-text-muted mt-2">
              Outfit scanning runs on this device. When PhotoRoom is configured, only each isolated garment cutout is sent to refine its edges; faces and the full photo are not sent.
            </p>
          )}

          {/* AI auto-fill banner */}
          {aiApplied && (
            <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-2xl bg-text-primary/8 border border-text-primary/15">
              <HangerIcon size={13} className="text-butter-yellow mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-butter-yellow">Auto-filled from your photo</p>
                <p className="text-2xs text-text-muted mt-0.5">Review and adjust any fields before saving.</p>
              </div>
              <button
                onClick={() => setAiApplied(false)}
                className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={!editItem}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* ── Name ── */}
        <div>
          <SectionLabel>Item name *</SectionLabel>
          <TextInput
            placeholder="e.g. White Linen Shirt, Black Blazer…"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            error={errors.name}
          />
        </div>

        {/* ── Category ── */}
        <div>
          <SectionLabel error={errors.category}>Category *</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  update('category', cat.value)
                  update('subcategory', '') // reset subcategory when category changes
                }}
                className={clsx(
                  'flex items-center px-4 py-2.5 rounded-full text-sm font-medium border transition-all duration-200',
                  draft.category === cat.value
                    ? 'bg-dark-purple text-butter-yellow border-dark-purple'
                    : 'bg-surface text-text-primary border-text-primary/15 hover:border-text-primary/40'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {errors.category && (
            <p className="text-xs text-red-500 mt-1.5">{errors.category}</p>
          )}
        </div>

        {/* ── Subcategory ── */}
        {subcategoryOptions && subcategoryOptions.length > 0 && (
          <div>
            <SectionLabel>Type</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {subcategoryOptions.map((sub) => (
                <SelectChip
                  key={sub}
                  label={sub}
                  selected={draft.subcategory === sub}
                  onClick={() => update('subcategory', draft.subcategory === sub ? '' : sub)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Colours ── */}
        <div>
          <SectionLabel>Colours</SectionLabel>
          <div className="flex flex-wrap gap-3">
            {COLOUR_PALETTE.map((colour) => (
              <div key={colour.name} className="flex flex-col items-center gap-1">
                <ColourSwatch
                  name={colour.name}
                  hex={colour.hex}
                  selected={draft.colour.includes(colour.name)}
                  onClick={() => toggleArray('colour', colour.name)}
                />
                <span className="text-2xs text-charcoal-400 text-center max-w-[48px] leading-tight truncate">
                  {colour.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pattern ── */}
        <div>
          <SectionLabel>Pattern</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {PATTERNS.map((p) => (
              <SelectChip
                key={p.value}
                label={p.label}
                selected={draft.pattern === p.value}
                onClick={() => update('pattern', p.value)}
              />
            ))}
          </div>
        </div>

        {/* ── Fit ── */}
        <div>
          <SectionLabel>Fit</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {FIT_OPTIONS.map((f) => (
              <SelectChip
                key={f}
                label={f}
                selected={draft.fit === f}
                onClick={() => update('fit', draft.fit === f ? '' : f)}
              />
            ))}
          </div>
        </div>

        {/* ── Formality ── */}
        <div>
          <SectionLabel>Formality</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {FORMALITY_OPTIONS.map((f) => (
              <SelectChip
                key={f}
                label={f}
                selected={draft.formality === f}
                onClick={() => update('formality', draft.formality === f ? '' : f)}
              />
            ))}
          </div>
        </div>

        {/* ── Material ── */}
        <div>
          <SectionLabel>Material</SectionLabel>
          <TextInput
            placeholder="e.g. Cotton, Wool, Silk, Denim…"
            value={draft.material}
            onChange={(e) => update('material', e.target.value)}
          />
        </div>

        {/* ── Seasons ── */}
        <div>
          <SectionLabel>Seasons</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <SelectChip
                key={s.value}
                label={s.label}
                selected={draft.seasons.includes(s.value)}
                onClick={() => toggleArray('seasons', s.value)}
              />
            ))}
          </div>
        </div>

        {/* ── Occasions ── */}
        <div>
          <SectionLabel>Occasions</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <SelectChip
                key={o.value}
                label={o.label}
                selected={draft.occasions.includes(o.value)}
                onClick={() => toggleArray('occasions', o.value)}
              />
            ))}
          </div>
        </div>

        {/* ── Brand + Notes ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Brand (optional)</SectionLabel>
            <TextInput
              placeholder="e.g. Zara, COS, Uniqlo…"
              value={draft.brand}
              onChange={(e) => update('brand', e.target.value)}
            />
          </div>
          <div>
            <SectionLabel>Notes (optional)</SectionLabel>
            <TextInput
              placeholder="Any notes about this piece…"
              value={draft.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </div>
        </div>


      </div>
    </Modal>
  )
}

function SectionLabel({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <p className={clsx('text-sm font-medium mb-3', error ? 'text-red-500' : 'text-text-primary')}>
      {children}
    </p>
  )
}

// ─── Image Search Browser ──────────────────────────────────────────────────────

interface PexelsPhoto {
  id: number
  url: string
  thumbUrl: string
  alt: string
  photographer: string
}

function ImageSearchBrowser({
  defaultQuery,
  onSelect,
}: {
  defaultQuery: string
  onSelect: (url: string) => void
}) {
  const [query, setQuery] = useState(defaultQuery || 'clothing fashion')
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [noKey, setNoKey] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (q: string, p = 1) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl(`/api/search-images?q=${encodeURIComponent(q)}&page=${p}`))
      const data = await res.json()
      if (data.noKey) { setNoKey(true); return }
      setPhotos(data.photos ?? [])
      setTotalResults(data.totalResults ?? 0)
      setPage(p)
    } catch {
      setError('Could not load images — make sure the API server is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-search on mount with the default query
  useEffect(() => {
    search(query, 1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(totalResults / 18)

  if (noKey) {
    return (
      <div className="rounded-2xl border border-text-primary/15 bg-text-primary/3 p-5 text-center space-y-2">
        <p className="text-sm font-medium text-text-primary">Image search not set up</p>
        <p className="text-xs text-text-muted leading-relaxed">
          Add a free Pexels API key to <span className="font-mono bg-text-primary/8 px-1 rounded">PEXELS_API_KEY</span> in your <span className="font-mono bg-text-primary/8 px-1 rounded">.env</span> file, then restart the server.
        </p>
        <a
          href="https://www.pexels.com/api/"
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs text-butter-yellow underline underline-offset-2 mt-1"
        >
          Get a free key at pexels.com/api →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(query, 1) }}
            placeholder="e.g. black blazer, white sneakers…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-text-primary/20 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary/50 bg-surface"
          />
        </div>
        <button
          type="button"
          onClick={() => search(query, 1)}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-dark-purple text-butter-yellow text-sm font-medium hover:bg-deep-purple transition-colors disabled:opacity-40"
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-butter-yellow/40 border-t-butter-yellow animate-spin" />
          ) : 'Search'}
        </button>
      </div>

      {/* Results grid */}
      {error ? (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">{error}</p>
      ) : loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-text-primary/8 animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-6">No results for "{query}" — try different words.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onSelect(photo.url)}
              className="relative aspect-[3/4] rounded-xl overflow-hidden hover:scale-[0.97] hover:shadow-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow"
              title={photo.alt}
            >
              <img
                src={photo.thumbUrl}
                alt={photo.alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => search(query, page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={13} />
            Prev
          </button>
          <span className="text-xs text-text-muted">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => search(query, page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
          >
            Next
            <ChevronRightIcon size={13} />
          </button>
        </div>
      )}

      {/* Pexels attribution */}
      {photos.length > 0 && (
        <p className="text-2xs text-text-muted text-center">
          Photos provided by{' '}
          <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Pexels
          </a>
        </p>
      )}
    </div>
  )
}
