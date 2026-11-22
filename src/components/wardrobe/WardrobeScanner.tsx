import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Check, Loader2, Trash2, X } from 'lucide-react'
import { clsx } from 'clsx'
import { analyzeImage, type ClothingAnalysis } from '@/lib/analyzeImage'
import { saveImage } from '@/lib/imageStorage'
import { SCAN_CATEGORIES, categoryFromAnalysis, itemFromScan } from '@/lib/scanItem'
import type { ClothingCategory, ClothingItem } from '@/types'

// Wardrobe scanning: the camera stays open and the person shows pieces one
// after another. A piece is captured on its own once the view has changed
// since the last capture and then held still for about a second (or with the
// shutter). Each capture is tagged in the background, one at a time so the
// photo-reading limit isn't hit, and everything is reviewed and saved at the end.

interface ScanPiece {
  key: string
  blob: Blob
  previewUrl: string
  status: 'queued' | 'tagging' | 'tagged' | 'failed'
  analysis: ClothingAnalysis | null
  name: string
  category: ClothingCategory | null
}

// Auto-capture tuning, on a tiny 48×64 greyscale copy of the camera image.
const SAMPLE_W = 48
const SAMPLE_H = 64
const STILL_MOTION = 7      // average change between frames that still counts as "held still"
const NEW_SCENE = 12        // average change in the centre (where the piece is held) that counts as a new piece
const MIN_DETAIL = 14       // a blank wall or covered lens has too little detail to capture
const HOLD_MS = 1000        // how long to hold still before it captures
const AFTER_CAPTURE_MS = 1500
const TICK_MS = 200

function meanDiff(a: Uint8Array, b: Uint8Array): number {
  let total = 0
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i])
  return total / a.length
}
// Compare just the middle of the frame, where the guide asks them to hold the
// piece: a new piece in the same spot changes the centre a lot but the whole
// frame only a little.
function centreDiff(a: Uint8Array, b: Uint8Array): number {
  let total = 0
  let count = 0
  for (let y = Math.floor(SAMPLE_H * 0.2); y < Math.ceil(SAMPLE_H * 0.8); y++) {
    for (let x = Math.floor(SAMPLE_W * 0.2); x < Math.ceil(SAMPLE_W * 0.8); x++) {
      const i = y * SAMPLE_W + x
      total += Math.abs(a[i] - b[i])
      count++
    }
  }
  return total / count
}
function detail(a: Uint8Array): number {
  let mean = 0
  for (const v of a) mean += v
  mean /= a.length
  let variance = 0
  for (const v of a) variance += (v - mean) ** 2
  return Math.sqrt(variance / a.length)
}

export function WardrobeScanner({ open, onClose, onSaveItems }: {
  open: boolean
  onClose: () => void
  onSaveItems: (items: ClothingItem[]) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sampleCanvas = useRef<HTMLCanvasElement | null>(null)
  const [phase, setPhase] = useState<'camera' | 'review'>('camera')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [pieces, setPieces] = useState<ScanPiece[]>([])
  const [holdProgress, setHoldProgress] = useState(0)
  const [flash, setFlash] = useState(false)
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const lastCaptured = useRef<Uint8Array | null>(null)
  const previousFrame = useRef<Uint8Array | null>(null)
  const stillFor = useRef(0)
  const lastCaptureAt = useRef(0)

  // ── Camera on/off ──
  useEffect(() => {
    if (!open || phase !== 'camera') return
    let stream: MediaStream | null = null
    let cancelled = false
    setCameraError(null)
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((media) => {
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return }
        stream = media
        if (videoRef.current) {
          videoRef.current.srcObject = media
          void videoRef.current.play().catch(() => {})
        }
      })
      .catch((error: unknown) => {
        console.warn('[scanner] camera unavailable', error)
        const name = error instanceof DOMException ? error.name : ''
        setCameraError(name === 'NotAllowedError'
          ? 'Kloset needs your camera to scan. Allow camera access in your browser settings, then try again.'
          : 'Couldn’t open the camera on this device. You can still add pieces with Upload.')
      })
    if (!navigator.mediaDevices?.getUserMedia) setCameraError('This browser can’t open the camera here. You can still add pieces with Upload.')
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [open, phase])

  // Fresh state each time the scanner opens; photo previews freed when it closes.
  useEffect(() => {
    if (!open) return
    setPhase('camera')
    setPieces([])
    lastCaptured.current = null
    previousFrame.current = null
    stillFor.current = 0
  }, [open])
  useEffect(() => () => { pieces.forEach((piece) => URL.revokeObjectURL(piece.previewUrl)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Capture ──
  const capture = useCallback((sample: Uint8Array | null) => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    lastCaptured.current = sample
    lastCaptureAt.current = Date.now()
    stillFor.current = 0
    setHoldProgress(0)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 180)
    canvas.toBlob((blob) => {
      if (!blob) return
      const piece: ScanPiece = { key: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob), status: 'queued', analysis: null, name: '', category: null }
      console.log('[scanner] captured piece', { bytes: blob.size })
      setPieces((current) => [...current, piece])
    }, 'image/jpeg', 0.88)
  }, [])

  const sampleFrame = useCallback((): Uint8Array | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    sampleCanvas.current ??= Object.assign(document.createElement('canvas'), { width: SAMPLE_W, height: SAMPLE_H })
    const context = sampleCanvas.current.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H)
    const { data } = context.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
    const grey = new Uint8Array(SAMPLE_W * SAMPLE_H)
    for (let i = 0; i < grey.length; i++) grey[i] = (data[i * 4] * 3 + data[i * 4 + 1] * 6 + data[i * 4 + 2]) / 10
    return grey
  }, [])

  // ── Automatic capture: a new view, held still ──
  useEffect(() => {
    if (!open || phase !== 'camera' || cameraError) return
    const timer = window.setInterval(() => {
      const frame = sampleFrame()
      if (!frame) return
      const motion = previousFrame.current ? meanDiff(previousFrame.current, frame) : 255
      previousFrame.current = frame
      const isNew = !lastCaptured.current || centreDiff(lastCaptured.current, frame) > NEW_SCENE
      const ready = isNew && detail(frame) > MIN_DETAIL && Date.now() - lastCaptureAt.current > AFTER_CAPTURE_MS
      stillFor.current = ready && motion < STILL_MOTION ? stillFor.current + TICK_MS : 0
      setHoldProgress(ready ? Math.min(1, stillFor.current / HOLD_MS) : 0)
      if (stillFor.current >= HOLD_MS) capture(frame)
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [open, phase, cameraError, sampleFrame, capture])

  // ── Tagging, one piece at a time ──
  useEffect(() => {
    if (!open || pieces.some((piece) => piece.status === 'tagging')) return
    const next = pieces.find((piece) => piece.status === 'queued')
    if (!next) return
    setPieces((current) => current.map((piece) => piece.key === next.key ? { ...piece, status: 'tagging' } : piece))
    analyzeImage(next.blob, setWaitSeconds)
      .then((analysis) => {
        setPieces((current) => current.map((piece) => piece.key === next.key ? {
          ...piece,
          status: 'tagged',
          analysis,
          name: piece.name || analysis.name || '',
          category: piece.category ?? categoryFromAnalysis(analysis),
        } : piece))
      })
      .catch((error) => {
        console.warn('[scanner] tagging failed', error)
        setPieces((current) => current.map((piece) => piece.key === next.key ? { ...piece, status: 'failed' } : piece))
      })
      .finally(() => setWaitSeconds(null))
  }, [open, pieces])

  const updatePiece = (key: string, change: Partial<ScanPiece>) => setPieces((current) => current.map((piece) => piece.key === key ? { ...piece, ...change } : piece))
  const removePiece = (key: string) => setPieces((current) => {
    const gone = current.find((piece) => piece.key === key)
    if (gone) URL.revokeObjectURL(gone.previewUrl)
    return current.filter((piece) => piece.key !== key)
  })

  const readyToSave = pieces.filter((piece) => piece.category)
  const saveAll = async () => {
    setSaving(true)
    try {
      const items: ClothingItem[] = []
      for (const piece of readyToSave) {
        const imageId = await saveImage(piece.blob)
        items.push(itemFromScan({ imageId, name: piece.name, category: piece.category as ClothingCategory, analysis: piece.analysis }))
      }
      console.log('[scanner] saving pieces', { count: items.length })
      onSaveItems(items)
      pieces.forEach((piece) => URL.revokeObjectURL(piece.previewUrl))
      setPieces([])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  const tagging = pieces.filter((piece) => piece.status === 'queued' || piece.status === 'tagging').length

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Scan your wardrobe" className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      {phase === 'camera' ? <>
        <div className="relative flex-1 overflow-hidden">
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
          {flash && <div className="absolute inset-0 bg-white/70" />}
          {/* Where to hold the piece, with the hold-still ring */}
          {!cameraError && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative aspect-[3/4] h-[58%] max-w-[80%] rounded-3xl border-2 border-dashed border-white/60">
              {holdProgress > 0 && <svg className="absolute -right-4 -top-4 h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r="20" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#FFFDD0" strokeWidth="4" strokeDasharray={`${holdProgress * 125.6} 125.6`} strokeLinecap="round" />
              </svg>}
            </div>
            <p className="mt-4 rounded-full bg-black/50 px-4 py-1.5 text-sm">{holdProgress > 0 ? 'Hold still…' : pieces.length ? 'Next piece' : 'Hold one piece up to the camera'}</p>
          </div>}
          {cameraError && <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-white/80">{cameraError}</div>}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <button type="button" onClick={onClose} aria-label="Close scanner" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50"><X size={20} /></button>
            <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs">{pieces.length} scanned{tagging ? ` · tagging ${tagging}` : ''}{waitSeconds ? ` · busy, retrying in ${waitSeconds}s` : ''}</span>
          </div>
        </div>
        {/* Captured pieces, with what tagging found */}
        <div className="flex gap-2 overflow-x-auto bg-black px-4 pt-3 no-scrollbar" aria-label="Scanned pieces">
          {pieces.map((piece) => (
            <div key={piece.key} className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-white/10">
              <img src={piece.previewUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px]">
                {piece.status === 'tagged' ? (piece.name || SCAN_CATEGORIES.find((c) => c.value === piece.category)?.label || 'Tagged') : piece.status === 'failed' ? 'Tag later' : 'Tagging…'}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 bg-black px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <span className="w-24 text-xs text-white/60">Auto-captures when you hold still</span>
          <button type="button" onClick={() => capture(sampleFrame())} disabled={!!cameraError} aria-label="Capture this piece" className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-white/20 disabled:opacity-40"><Camera size={22} /></button>
          <button type="button" onClick={() => setPhase('review')} disabled={!pieces.length} className="w-24 rounded-full bg-[#FFFDD0] px-4 py-2 text-sm font-medium text-black disabled:opacity-40">Done{pieces.length ? ` (${pieces.length})` : ''}</button>
        </div>
      </> : (
        // ── Review: fix names and types, remove misses, save all ──
        <div className="flex h-full flex-col bg-warm-cream text-text-primary">
          <div className="flex items-center justify-between border-b border-text-primary/10 px-4 py-3">
            <button type="button" onClick={() => setPhase('camera')} className="text-sm text-text-muted hover:text-text-primary">Scan more</button>
            <h2 className="font-display text-lg">Review {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}</h2>
            <button type="button" onClick={onClose} aria-label="Close scanner" className="p-1 text-text-muted hover:text-text-primary"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tagging > 0 && <p className="mb-3 flex items-center gap-2 text-xs text-text-muted"><Loader2 size={13} className="animate-spin" /> Still tagging {tagging} {tagging === 1 ? 'piece' : 'pieces'}{waitSeconds ? ` (busy, retrying in ${waitSeconds}s)` : ''}. You can edit while it works.</p>}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {pieces.map((piece) => (
                <div key={piece.key} className="overflow-hidden rounded-2xl border border-text-primary/10 bg-surface">
                  <div className="relative aspect-[3/4]">
                    <img src={piece.previewUrl} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removePiece(piece.key)} aria-label="Remove this piece" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"><Trash2 size={14} /></button>
                    {(piece.status === 'queued' || piece.status === 'tagging') && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white"><Loader2 size={11} className="animate-spin" /> Tagging</span>}
                    {piece.status === 'tagged' && <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#355E3B] text-white"><Check size={13} /></span>}
                  </div>
                  <div className="space-y-2 p-2.5">
                    <input value={piece.name} onChange={(event) => updatePiece(piece.key, { name: event.target.value })} placeholder={piece.status === 'tagged' || piece.status === 'failed' ? 'Name this piece' : 'Naming…'} aria-label="Piece name" maxLength={80} className="w-full border-b border-text-primary/15 bg-transparent py-1 text-sm focus:border-text-primary/50 focus:outline-none" />
                    <select value={piece.category ?? ''} onChange={(event) => updatePiece(piece.key, { category: (event.target.value || null) as ClothingCategory | null })} aria-label="Piece type" className={clsx('w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs', piece.category ? 'border-text-primary/15' : 'border-amber-600/60 text-amber-700')}>
                      <option value="">Choose type…</option>
                      {SCAN_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-text-primary/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {readyToSave.length < pieces.length && <p className="mb-2 text-center text-xs text-text-muted">{pieces.length - readyToSave.length} without a type won’t be saved. Choose a type, or wait for tagging.</p>}
            <button type="button" onClick={() => void saveAll()} disabled={!readyToSave.length || saving} className="w-full rounded-full bg-[#355E3B] py-3 text-sm font-medium text-[#FFFDD0] disabled:opacity-40">
              {saving ? 'Saving…' : `Add ${readyToSave.length} ${readyToSave.length === 1 ? 'piece' : 'pieces'} to Kloset`}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
