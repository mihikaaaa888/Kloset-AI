import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, ImagePlus, X, ChevronRight, SkipForward, Link, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { SelectChip } from '@/components/ui/SelectChip'
import { ColourSwatch } from '@/components/ui/ColourSwatch'
import { COLOUR_PALETTE } from '@/lib/colourUtils'
import {
  saveImage,
  getImage,
  deleteImage,
  validateImageFile,
  compressImage,
} from '@/lib/imageStorage'
import { getPhotoUrl } from '@/lib/wardrobeService'
import { analyzeImage, analyzeImageFromUrl, detectOutfitPieces } from '@/lib/analyzeImage'
import { apiFetch, apiUrl } from '@/lib/apiUrl'
import { imageSearchSuggestions } from '@/lib/searchSuggestions'
import { reportIssue } from '@/lib/clientReport'
import { parseOutfitPhoto } from '@/lib/fashionParsing'
import { deleteWithUndo, finalizeScope } from '@/store/undoStore'
import type { ClothingAnalysis } from '@/lib/analyzeImage'
import type { ClothingItem, ClothingCategory, Pattern, Season, Occasion } from '@/types'

// ─── Analysis helpers ─────────────────────────────────────────────────────────

/** Undo toasts from this form are tied to it and finish when it closes or saves. */
const UNDO_SCOPE = 'add-item'

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
  { value: 'outerwear', label: 'Woolens' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]

const SUBCATEGORIES: Partial<Record<ClothingCategory, string[]>> = {
  tops: ['t-shirt', 'shirt', 'polo', 'blouse', 'tank', 'other'],
  bottoms: ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'joggers', 'other'],
  dresses: ['mini dress', 'midi dress', 'maxi dress', 'wrap dress', 'shirt dress', 'slip dress', 'other'],
  outerwear: ['sweater', 'knit top', 'turtleneck', 'sweatshirt', 'hoodie', 'cardigan', 'coat', 'jacket', 'blazer', 'raincoat', 'puffer', 'parka', 'trench coat', 'other'],
  shoes: ['sneakers', 'boots', 'heels', 'flats', 'sandals', 'loafers', 'other'],
  accessories: ['bag', 'belt', 'hat', 'scarf', 'jewelry', 'sunglasses', 'watch', 'other'],
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
  neckline_closure: string
  construction: string
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
    neckline_closure: '',
    construction: '',
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

function draftForDetectedPiece(category?: ClothingCategory, name?: string): ItemDraft {
  return { ...blankDraft(), category: category ?? '', name: name ?? '' }
}

function itemToDraft(item: ClothingItem): ItemDraft {
  return {
    name: item.name,
    category: item.category,
    subcategory: item.subcategory ?? '',
    neckline_closure: item.neckline_closure ?? '',
    construction: item.construction ?? '',
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
  initialTab?: 'upload' | 'browse'
  initialFiles?: File[] | null
  /** A photo (or several) held two or more pieces: they're cropped and handed over to review together. */
  onSplitPieces?: (pieces: Array<{ blob: Blob; category?: ClothingCategory; name?: string }>) => void
}

export function AddItemModal({ open, onClose, onSave, editItem, initialTab = 'upload', initialFiles = null, onSplitPieces }: AddItemModalProps) {
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
  // Set while tagging waits out Groq's rate limit before its one retry.
  const [aiWaitSeconds, setAiWaitSeconds] = useState<number | null>(null)
  // Count the wait down once a second so it doesn't look frozen.
  const waiting = aiWaitSeconds !== null && aiWaitSeconds > 0
  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(() => {
      // At 0 the overlay goes back to "Analysing…" while the retry runs.
      setAiWaitSeconds((seconds) => (seconds !== null && seconds > 0 ? seconds - 1 : seconds))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [waiting])
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([])

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
    setLowConfidenceFields([])
    setPhotoTab(initialTab)
    setUrlInput('')
    setUrlError(null)
    setUrlLoading(false)

    pendingMap.current = new Map()
    priorImageId.current = null
  }, [open, initialTab]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // Every piece from every photo, collected first: two or more go to the
      // sorted review (onSplitPieces) instead of one at a time here.
      const found: Array<{ blob: Blob; category?: ClothingCategory; name?: string }> = []
      for (const file of valid) {
        setImageProcessingStep('Loading the on-device clothing scanner…')
        const compressed = await compressImage(file)
        const parsed = await parseOutfitPhoto(compressed)
        let pieces: Array<{ blob: Blob; category?: ClothingCategory; name?: string }> = parsed.garments.length > 0
          ? parsed.garments
          : [{ blob: parsed.sourceFallback, category: undefined, name: undefined }]
        // The on-device model can return just one class for a layered outfit.
        // Ask vision to find separate pieces when local detection found fewer
        // than two garments, and prefer its crops only when it found more.
        if (parsed.garments.length < 2) {
          // Ran but found fewer than two pieces: note what it saw, to compare phones with computers.
          if (parsed.segmentationAvailable) reportIssue('splitter-few', `found ${parsed.garments.length}`, { labels: parsed.foundLabels.join(',').slice(0, 200) })
          setImageProcessingStep('Finding separate clothing pieces…')
          try {
            const detected = await detectOutfitPieces(compressed, (seconds) => {
              setImageProcessingStep(`Photo scanning is busy. Trying again in ${seconds}s…`)
            })
            if (detected.length > parsed.garments.length) {
              // Keep only boxes the on-device clothing outline confirms, as
              // zoomed crops. Cloud boxes can land beside the person (a wall, a
              // mirror); a plain crop of those is never shown.
              const confirmed = (await Promise.all(detected.map(async (piece) => {
                const blob = await parsed.cropForBox(piece.box)
                return blob ? { blob, category: VALID_CATEGORIES.has(piece.category) ? piece.category as ClothingCategory : undefined, name: piece.name } : null
              }))).filter((piece): piece is NonNullable<typeof piece> => !!piece)
              if (confirmed.length > parsed.garments.length) pieces = confirmed
              else {
                console.warn('[wardrobe] cloud pieces did not line up with the clothing; keeping on-device pieces', { cloud: detected.length, confirmed: confirmed.length, onDevice: parsed.garments.length })
                reportIssue('splitter-cloud-boxes', 'cloud boxes did not line up', { cloud: detected.length, confirmed: confirmed.length, onDevice: parsed.garments.length, boxes: detected.map((piece) => piece.box.join(' ')).join(' / ').slice(0, 200) })
              }
            }
          } catch (error) {
            console.warn('[wardrobe] cloud garment detection failed; keeping on-device results', error)
          }
        }
        if (editItem && pieces.length > 1) {
          pieces = [pieces.find((piece) => piece.category === editItem.category) ?? pieces[0]]
        }
        found.push(...pieces)
      }

      if (!editItem && onSplitPieces && found.length > 1) {
        console.log('[wardrobe] photo split into pieces', { photos: valid.length, pieces: found.length })
        onSplitPieces(found)
        return
      }

      for (const piece of found) {
        setImageProcessingStep('Saving garment…')
        // Save and preview the garment crop so each wardrobe item is framed
        // around the piece. If detection falls back, piece.blob is the original photo.
        const imageId = await saveImage(piece.blob)
        const url = URL.createObjectURL(piece.blob)
        processed.push({ imageId, previewUrl: url, blob: piece.blob, detectedCategory: piece.category, detectedName: piece.name })
        pendingMap.current.set(imageId, url)
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
      setDraft(draftForDetectedPiece(first.detectedCategory, first.detectedName))

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

  const processedInitialFiles = useRef<File[] | null>(null)
  useEffect(() => {
    if (!open || !initialFiles?.length || processedInitialFiles.current === initialFiles) return
    processedInitialFiles.current = initialFiles
    void processFiles(initialFiles)
  }, [open, initialFiles, processFiles])

  // ── AI analysis ──────────────────────────────────────────────────────────────
  const applyAnalysis = useCallback((analysis: ClothingAnalysis, detectedCategory?: ClothingCategory, detectedName?: string) => {
    const categoryConfidence = analysis.confidence?.category ?? 0
    const groqCategory = analysis.category && VALID_CATEGORIES.has(analysis.category)
      ? analysis.category as ClothingCategory
      : undefined
    const finalCategory = categoryConfidence >= 0.6
      ? groqCategory
      : (detectedCategory ?? groqCategory)
    const lowFields = [
      ...(categoryConfidence < 0.6 ? ['category'] : []),
      ...(analysis.subcategory && (analysis.confidence?.subcategory ?? 0) < 0.6 ? ['subcategory'] : []),
      ...(analysis.neckline_closure && (analysis.confidence?.neckline_closure ?? 0) < 0.6 ? ['neckline_closure'] : []),
      ...(analysis.construction && (analysis.confidence?.construction ?? 0) < 0.6 ? ['construction'] : []),
      ...(analysis.primaryColor && (analysis.confidence?.color ?? 0) < 0.6 ? ['colour'] : []),
      ...(analysis.material && (analysis.confidence?.material ?? 0) < 0.6 ? ['material'] : []),
    ]
    setLowConfidenceFields(lowFields)

    if (import.meta.env.DEV) {
      console.info('[garment-category-debug]', {
        localSegmentationCategory: detectedCategory ?? null,
        groqCategory: groqCategory ?? null,
        groqCategoryConfidence: categoryConfidence,
        finalCategory: finalCategory ?? null,
      })
    }

    setDraft((prev) => {
      const next = { ...prev }

      // Only fill the name if the user hasn't already typed one — everything
      // else is safe to overwrite since analysis runs immediately on upload,
      // before there's normally anything to type over.
      if (analysis.name && (!prev.name.trim() || (detectedName && prev.name === detectedName))) next.name = analysis.name
      else if (detectedName && !prev.name.trim()) next.name = detectedName

      const woolenSubcategories = new Set(['sweater', 'knit top', 'knitted top', 'turtleneck', 'pullover', 'sweatshirt', 'hoodie', 'cardigan', 'coat', 'jacket', 'blazer', 'raincoat', 'puffer', 'parka', 'trench coat'])
      const analysisSubcategory = analysis.subcategory?.toLowerCase()
      const resolvedCategory = analysisSubcategory && woolenSubcategories.has(analysisSubcategory) ? 'outerwear' : finalCategory
      if (resolvedCategory) next.category = resolvedCategory
      if (!analysis.subcategory) next.subcategory = ''
      else next.subcategory = analysis.subcategory
      next.neckline_closure = analysis.neckline_closure ?? ''
      next.construction = analysis.construction ?? ''

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
    setLowConfidenceFields([])
    try {
      const analysis = await analyzeImage(blob, setAiWaitSeconds)
      applyAnalysis(analysis, detectedCategory, detectedName)
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Photo tagging failed. Review the name and type before saving.')
    } finally {
      setAiAnalyzing(false)
      setAiWaitSeconds(null)
    }
  }, [applyAnalysis])

  // Same auto-detect, for images picked via URL or Pexels browse — those
  // never had a local Blob to hand to runAiAnalysis, so the server fetches
  // the URL itself (see analyzeImageFromUrl).
  const runAiAnalysisFromUrl = useCallback(async (url: string) => {
    setAiAnalyzing(true)
    setLowConfidenceFields([])
    try {
      const analysis = await analyzeImageFromUrl(url, setAiWaitSeconds)
      if (analysis) {
        applyAnalysis(analysis)
      }
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Photo tagging failed. Review the name and type before saving.')
    } finally {
      setAiAnalyzing(false)
      setAiWaitSeconds(null)
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
    const before = { activeImageId, legacyImageUrl, previewUrl, priorImageId: priorImageId.current }
    deleteWithUndo({
      message: 'Photo removed',
      scope: UNDO_SCOPE,
      remove: () => {
        // Track original imageId for deletion if user removes image in edit mode
        if (editItem?.imageId && !priorImageId.current) {
          priorImageId.current = editItem.imageId
        }
        // Note: pendingMap entries stay until modal closes — they'll be cleaned up there
        setActiveImageId(null)
        setLegacyImageUrl(null)
        setPreviewUrl(null)
      },
      restore: () => {
        priorImageId.current = before.priorImageId
        setActiveImageId(before.activeImageId)
        setLegacyImageUrl(before.legacyImageUrl)
        setPreviewUrl(before.previewUrl)
      },
    })
  }

  // ── Load image from URL ──────────────────────────────────────────────────────
  const handleUrlSubmit = useCallback(() => {
    const url = urlInput.trim()
    if (!url) return
    try { new URL(url) } catch {
      setUrlError('Please enter a valid link.')
      return
    }
    setUrlError(null)
    setUrlLoading(true)

    const useImage = (imageUrl: string) => {
      setUrlLoading(false)
      setPreviewUrl(imageUrl)
      setLegacyImageUrl(imageUrl)
      setActiveImageId(null)
      if (!editItem) runAiAnalysisFromUrl(imageUrl)
    }

    // Not an image itself, so treat it as a product page (e.g. the adidas
    // Samba page) and let the server find the product photo on it.
    const readProductPage = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/product-image'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json()
        if (!res.ok || !data.imageUrl) throw new Error(data.error)
        if (data.brand) setDraft((d) => (d.brand.trim() ? d : { ...d, brand: data.brand }))
        // Confirm the browser can actually show it before using it.
        const check = new Image()
        check.referrerPolicy = 'no-referrer'
        check.onload = () => useImage(data.imageUrl)
        check.onerror = () => {
          setUrlLoading(false)
          setUrlError("Found the product but couldn't load its photo. Try right-clicking the photo → Copy image address.")
        }
        check.src = data.imageUrl
      } catch (e) {
        setUrlLoading(false)
        setUrlError(e instanceof Error && e.message ? e.message : "Couldn't get a photo from that link. Try right-clicking the photo → Copy image address.")
      }
    }

    // A direct image link loads as-is.
    const img = new Image()
    // No crossOrigin here — we only need to display the image, not read pixels.
    // Setting crossOrigin would block most fashion/retail sites that don't send CORS headers.
    img.onload = () => useImage(url)
    img.onerror = () => { void readProductPage() }
    img.src = url
  }, [urlInput, editItem, runAiAnalysisFromUrl])

  // ── Cleanup on close ─────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    // An Undo left over from this form can't apply once it's closed.
    finalizeScope(UNDO_SCOPE)
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
    finalizeScope(UNDO_SCOPE)
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
      neckline_closure: draft.neckline_closure || undefined,
      construction: draft.construction || undefined,
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
      setDraft(draftForDetectedPiece(next.detectedCategory, next.detectedName))
      setErrors({})
      setImageError(null)
      runAiAnalysis(next.blob, next.detectedCategory, next.detectedName)
    } else {
      handleClose()
    }
  }

  // ── Skip in batch ────────────────────────────────────────────────────────────
  const handleSkip = () => {
    if (!isInBatch || batchIdx >= uploadBatch.length) return
    finalizeScope(UNDO_SCOPE)
    const skippedIdx = batchIdx
    const current = uploadBatch[skippedIdx]

    const showGarment = (idx: number) => {
      const next = uploadBatch[idx]
      setBatchIdx(idx)
      setActiveImageId(next.imageId)
      setPreviewUrl(next.previewUrl)
      setLegacyImageUrl(null)
      setDraft(draftForDetectedPiece(next.detectedCategory, next.detectedName))
      setErrors({})
      setImageError(null)
      runAiAnalysis(next.blob, next.detectedCategory, next.detectedName)
    }

    const nextIdx = skippedIdx + 1
    // Skipping the last photo closes the form, so there's nothing to go back to.
    if (!current || nextIdx >= uploadBatch.length) {
      if (current) {
        deleteImage(current.imageId).catch(() => {})
        URL.revokeObjectURL(current.previewUrl)
        pendingMap.current.delete(current.imageId)
      }
      handleClose()
      return
    }

    // The photo stays in pendingMap until the toast closes, so closing the form still cleans it up.
    deleteWithUndo({
      message: `Skipped garment ${skippedIdx + 1}`,
      scope: UNDO_SCOPE,
      remove: () => showGarment(nextIdx),
      restore: () => showGarment(skippedIdx),
      commit: () => {
        deleteImage(current.imageId).catch(() => {})
        URL.revokeObjectURL(current.previewUrl)
        pendingMap.current.delete(current.imageId)
      },
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const subcategoryOptions = draft.category ? SUBCATEGORIES[draft.category as ClothingCategory] : undefined
  const isLowConfidence = (field: string) => lowConfidenceFields.includes(field)
  const reviewFieldClass = (field: string) => isLowConfidence(field)
    ? 'rounded-xl border border-amber-500/60 bg-amber-50/40 p-3'
    : ''

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
                className="w-full h-full object-contain"
              />

              {/* AI analysing overlay */}
              {aiAnalyzing && (
                <div className="absolute inset-0 bg-scrim/30 backdrop-blur-sm flex items-center justify-center">
                  <div className="bg-surface/95 rounded-2xl px-4 py-3 flex items-center gap-2.5 shadow-soft">
                    <div className="w-4 h-4 rounded-full border-2 border-butter-yellow/20 border-t-butter-yellow animate-spin" />
                    <span className="text-xs font-medium text-text-primary">
                      {aiWaitSeconds ? `Tagging is busy. Trying again in ${aiWaitSeconds}s…` : 'Analysing…'}
                    </span>
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
              defaultQuery={draft.subcategory ?? ''}
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
                  placeholder="Paste a product page or image link…"
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
                Paste a link to the item on any fashion site (e.g. a pair of Sambas on adidas.com) and we'll pull in its photo. Direct image links work too.
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
        <div className={reviewFieldClass('category')}>
          <SectionLabel error={errors.category} review={isLowConfidence('category')}>Category *</SectionLabel>
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
          <div className={reviewFieldClass('subcategory')}>
            <SectionLabel review={isLowConfidence('subcategory')}>Type</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {subcategoryOptions.map((sub) => (
                <SelectChip
                  key={sub}
                  label={sub.replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  selected={draft.subcategory === sub}
                  onClick={() => update('subcategory', draft.subcategory === sub ? '' : sub)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Detailed attributes are editable when reviewing an existing piece. */}
        {!!editItem && <>
        {/* ── Garment construction details: optional, folded away (hard to answer) ── */}
        <details className="group rounded-xl border border-text-primary/10 px-4 py-3">
        <summary className="cursor-pointer text-sm text-text-muted marker:content-none">More details (optional)</summary>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={reviewFieldClass('neckline_closure')}>
            <SectionLabel review={isLowConfidence('neckline_closure')}>Neckline / closure</SectionLabel>
            <select
              value={draft.neckline_closure}
              onChange={(e) => update('neckline_closure', e.target.value)}
              className="w-full rounded-xl border border-text-primary/15 bg-surface px-3 py-2.5 text-sm text-text-primary"
            >
              <option value="">Not specified</option>
              {['crew', 'v-neck', 'turtleneck', 'collared', 'quarter-zip', 'half-zip', 'full-zip', 'button-up', 'hooded', 'other'].map((value) => (
                <option key={value} value={value}>{value.replace(/-/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className={reviewFieldClass('construction')}>
            <SectionLabel review={isLowConfidence('construction')}>Construction</SectionLabel>
            <select
              value={draft.construction}
              onChange={(e) => update('construction', e.target.value)}
              className="w-full rounded-xl border border-text-primary/15 bg-surface px-3 py-2.5 text-sm text-text-primary"
            >
              <option value="">Not specified</option>
              {['knit', 'fleece', 'jersey', 'woven', 'denim', 'other'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
        </details>

        {/* ── Colours ── */}
        <div className={reviewFieldClass('colour')}>
          <SectionLabel review={isLowConfidence('colour')}>Colours</SectionLabel>
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
        <div className={reviewFieldClass('material')}>
          <SectionLabel review={isLowConfidence('material')}>Material</SectionLabel>
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

        <div>
          <SectionLabel>Brand (optional)</SectionLabel>
          <TextInput
            placeholder="e.g. Zara, COS, Uniqlo…"
            value={draft.brand}
            onChange={(e) => update('brand', e.target.value)}
          />
        </div>
        </>}

        {/* ── Notes ── */}
        <div>
          <SectionLabel>Notes (optional)</SectionLabel>
          <TextInput
            placeholder="Any notes about this piece…"
            value={draft.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </div>


      </div>
    </Modal>
  )
}

function SectionLabel({ children, error, review }: { children: React.ReactNode; error?: string; review?: boolean }) {
  return (
    <p className={clsx('text-sm font-medium mb-3 flex items-center gap-2', error ? 'text-red-500' : 'text-text-primary')}>
      {children}
      {review && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">Please confirm</span>}
    </p>
  )
}

// ─── Product Search Browser ────────────────────────────────────────────────────

const POPULAR_SEARCHES = ['white t-shirt', 'blue jeans', 'black dress', 'white sneakers', 'blazer', 'tote bag']

const BROWSE_ITEM_QUERIES = [
  ['Tops', 'shirt blouse t-shirt'],
  ['Bottoms', 'trousers jeans skirt'],
  ['Dresses', 'dress'],
  ['Woolens', 'sweater cardigan jacket coat'],
  ['Shoes', 'shoes'],
  ['Accessories', 'bag jewellery accessory'],
] as const

// Logos, app icons and site banners are small or much wider than tall once
// loaded; product photos are roughly square or portrait.
function looksLikeLogoOrBanner(img: HTMLImageElement) {
  const { naturalWidth: w, naturalHeight: h } = img
  return w < 160 || h < 160 || w / h > 1.6
}

interface WebImage {
  id: string | number
  url: string
  thumbUrl: string
  alt: string
  photographer: string
  /** Set for web results: the site the photo was found on. */
  source?: string
  sourceUrl?: string
}

function ImageSearchBrowser({
  defaultQuery,
  onSelect,
}: {
  defaultQuery: string
  onSelect: (url: string) => void
}) {
  const [query, setQuery] = useState(defaultQuery)
  const [photos, setPhotos] = useState<WebImage[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [noKey, setNoKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'web' | 'pexels'>('web')
  // Hotlinked web images can 404, block embedding, or turn out to be a logo
  // or banner once loaded — drop them from the grid.
  const [broken, setBroken] = useState<Set<string>>(new Set())

  // Suggestions while typing; hidden once a search runs.
  const [typing, setTyping] = useState(false)
  const suggestions = imageSearchSuggestions(query)
  const search = useCallback(async (q: string, p = 1) => {
    // One letter isn't worth searching: take the best suggestion instead ("j" → jeans).
    const searchQuery = q.trim().length < 2 ? imageSearchSuggestions(q)[0] ?? '' : q.trim()
    setTyping(false)
    if (!searchQuery) return
    if (searchQuery !== q.trim()) setQuery(searchQuery)
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(apiUrl(`/api/search-images?q=${encodeURIComponent(searchQuery)}&page=${p}&source=web`))
      const data = await res.json()
      if (data.noKey) { setNoKey(true); setPhotos([]); return }
      setNoKey(false)
      if (!res.ok) throw new Error(data.error)
      setPhotos(data.photos ?? [])
      setSource(data.source === 'web' ? 'web' : 'pexels')
      setBroken(new Set())
      setTotalPages(data.totalPages ?? 0)
      setPage(p)
    } catch {
      setError('Could not load images. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setQuery(defaultQuery)
    void search(defaultQuery, 1)
  }, [defaultQuery, search])

  const visible = photos.filter((p) => !broken.has(p.url))
  // Nothing found (or photo search is off): offer other searches instead of a dead end.
  const related = imageSearchSuggestions(query.trim().split(' ')[0] ?? '').filter((option) => option !== query.trim())
  const tryInstead = (related.length ? related : POPULAR_SEARCHES.filter((option) => option !== query.trim())).slice(0, 5)

  return (
    <div className="space-y-3">
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Browse item categories">
          {BROWSE_ITEM_QUERIES.map(([label, itemQuery]) => (
            <button key={label} type="button" onClick={() => { setQuery(itemQuery); search(itemQuery, 1) }} className="shrink-0 rounded-full border border-text-primary/15 px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-text-primary/35 hover:text-text-primary">{label}</button>
          ))}
        </div>
      </div>
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setTyping(true) }}
            onKeyDown={(e) => { if (e.key === 'Enter') search(query, 1); if (e.key === 'Escape') setTyping(false) }}
            onBlur={() => setTimeout(() => setTyping(false), 150)}
            role="combobox"
            aria-expanded={typing && suggestions.length > 0}
            aria-controls="image-search-suggestions"
            aria-autocomplete="list"
            placeholder="e.g. Dior heels, Zara black blazer…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-text-primary/20 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary/50 bg-surface"
          />
          {typing && suggestions.length > 0 && (
            <ul id="image-search-suggestions" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-text-primary/15 bg-surface py-1 shadow-lifted">
              {suggestions.map((option) => (
                <li key={option} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQuery(option); void search(option, 1) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary hover:bg-text-primary/5">
                    <Search size={13} className="shrink-0 text-text-muted" />
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
      ) : visible.length === 0 ? (
        tryInstead.length && (query.trim() || noKey) ? (
          <div className="flex flex-wrap items-center gap-2 py-4">
            <span className="text-xs text-text-muted">Try</span>
            {tryInstead.map((option) => (
              <button key={option} type="button" onClick={() => { setQuery(option); void search(option, 1) }} className="rounded-full border border-text-primary/15 px-3 py-1.5 text-xs text-text-primary transition-colors hover:border-text-primary/35">{option}</button>
            ))}
          </div>
        ) : null
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {visible.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onSelect(photo.url)}
              className="relative aspect-[3/4] rounded-xl overflow-hidden hover:scale-[0.97] hover:shadow-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow"
              title={photo.source ? `${photo.alt} — ${photo.source}` : photo.alt}
            >
              <img
                src={photo.thumbUrl}
                alt={photo.alt}
                className="w-full h-full object-cover bg-white"
                loading="lazy"
                referrerPolicy="no-referrer"
                onLoad={(e) => { if (looksLikeLogoOrBanner(e.currentTarget)) setBroken((prev) => new Set(prev).add(photo.url)) }}
                onError={() => setBroken((prev) => new Set(prev).add(photo.url))}
              />
              {photo.source && (
                <span className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 text-[10px] text-white bg-black/45 truncate text-left">
                  {photo.source}
                </span>
              )}
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
            className="text-xs text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
          >
            ‹ Prev
          </button>
          <span className="text-xs text-text-muted">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => search(query, page + 1)}
            disabled={page >= totalPages}
            className="text-xs text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
          >
            Next ›
          </button>
        </div>
      )}

      {/* Attribution */}
      {visible.length > 0 && (
        <p className="text-[10px] text-text-muted text-center">
          {source === 'web'
            ? "Images from around the web — check you're happy using a photo before saving it."
            : <>Photos provided by <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">Pexels</a></>}
        </p>
      )}
    </div>
  )
}
