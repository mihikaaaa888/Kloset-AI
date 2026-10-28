import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { ImagePlus, RefreshCw, X } from 'lucide-react'
import {
  SAMPLE_OUTFITS,
  accessoryPieces,
  assignHangers,
  chooseRackOutfits,
  loadRackOutfits,
  type RackOutfit,
  type RackPiece,
  type SampleGarmentKind,
} from '@/lib/rackOutfits'

/*
 * Geometry of /images/landing-rack-wide-cutout.png (1920×819). The rack only
 * occupies x 263–1659, y 35–793 of the file, so the stage is sized to that box
 * and the image is offset inside it — the rack fills the stage edge to edge.
 * Everything else is placed in container units of the stage (cqw / cqh).
 */
const RACK_SRC = '/images/landing-rack-wide-cutout.png'
const RACK_BOX = { x: 263, y: 35, w: 1396, h: 758, fileW: 1920, fileH: 819 }
const ROD_TOP = 1.06 // cqh — top edge of the rod
const ROD_THICKNESS = 3.43 // cqh
// Hangers spread across the rod between the uprights, clear of the end caps.
const HANG_SPAN: [number, number] = [11.5, 88.5] // cqw
// The hook graphic is drawn in rod-thickness units (see Hook): its viewBox
// starts 0.45 rods above the rod's top edge and reaches the hanger neck at 2.15.
const HOOK_TOP = ROD_TOP - 0.45 * ROD_THICKNESS
const NECK_TOP = HOOK_TOP + 2.15 * ROD_THICKNESS
// Hanger body (/images/wooden-hanger-body.png, 932×426): the bar sits ~86% down.
const HANGER_ASPECT = 426 / 932
const BAR_DEPTH = HANGER_ASPECT * 0.86
// Garments keep their size however wide the rack gets.
const HANGER_WIDTH = 'clamp(44px, 7.4vw, 112px)'
const SIDEWAYS_DEG = 30
const SIBLING_DEG = 13

const rackArtStyle: CSSProperties = {
  left: `${(-RACK_BOX.x / RACK_BOX.w) * 100}%`,
  top: `${(-RACK_BOX.y / RACK_BOX.h) * 100}%`,
  width: `${(RACK_BOX.fileW / RACK_BOX.w) * 100}%`,
  height: `${(RACK_BOX.fileH / RACK_BOX.h) * 100}%`,
}
const rackMask: CSSProperties = {
  WebkitMaskImage: `url(${RACK_SRC})`,
  maskImage: `url(${RACK_SRC})`,
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%',
}

interface InteractiveRackHeroProps {
  immersed?: boolean
  sceneRef?: RefObject<HTMLDivElement>
}

/** The landing rack: six outfits on eight wooden hangers, plus uploads. */
export function InteractiveRackHero({ immersed = false, sceneRef }: InteractiveRackHeroProps) {
  const [userOutfits, setUserOutfits] = useState<RackOutfit[]>([])
  const [shown, setShown] = useState<RackOutfit[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    loadRackOutfits().then((outfits) => {
      if (cancelled) return
      setUserOutfits(outfits)
      setShown(chooseRackOutfits(outfits, SAMPLE_OUTFITS))
    })
    return () => { cancelled = true }
  }, [])

  const slots = useMemo(() => assignHangers(shown), [shown])
  const urls = useBlobUrls(shown)
  const pieceById = useMemo(() => new Map(shown.flatMap((outfit) => outfit.pieces.map((piece) => [piece.id, piece] as const))), [shown])
  const outfitById = useMemo(() => new Map(shown.map((outfit) => [outfit.id, outfit] as const)), [shown])

  const selected = selectedId ? pieceById.get(selectedId) ?? null : null
  const activeOutfitId = (hoveredId && pieceById.get(hoveredId)?.outfitId) || selected?.outfitId || null

  const shuffle = () => {
    setSelectedId(null)
    setShown(chooseRackOutfits(userOutfits, SAMPLE_OUTFITS))
  }

  const upload = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    setSelectedId(null)
    console.log('[rack] uploading outfit photos', { count: files.length })
    // Loaded on demand: it pulls in the segmentation model only when someone uploads.
    const { separateOutfitPhoto } = await import('@/lib/outfitSeparation')
    const added: RackOutfit[] = []
    const skipped: string[] = []
    for (const [index, file] of files.entries()) {
      const prefix = files.length > 1 ? `Photo ${index + 1} of ${files.length} · ` : ''
      try {
        const outfit = await separateOutfitPhoto(file, (message) => setStatus(prefix + message))
        if (outfit) {
          added.push(outfit)
          setUserOutfits((current) => [outfit, ...current])
        } else {
          skipped.push(file.name)
        }
      } catch (error) {
        console.error('[rack] could not separate photo', { file: file.name, error })
        skipped.push(file.name)
      }
    }
    const all = [...added, ...userOutfits]
    setShown(chooseRackOutfits(all, SAMPLE_OUTFITS, { pinned: added.map((outfit) => outfit.id) }))
    const pieceCount = added.reduce((sum, outfit) => sum + outfit.pieces.length, 0)
    setStatus([
      added.length ? `Added ${added.length} outfit${added.length === 1 ? '' : 's'} · ${pieceCount} piece${pieceCount === 1 ? '' : 's'}` : null,
      skipped.length ? `No clothing found in ${skipped.length} photo${skipped.length === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · '))
    setBusy(false)
  }

  // Controls fade in only once the rack has been fully revealed by the door.
  const chromeStyle: CSSProperties | undefined = immersed
    ? { opacity: 'clamp(0, calc((var(--rack-reveal, 1) - 0.92) * 12.5), 1)' }
    : undefined

  return (
    <section
      ref={sceneRef}
      style={{
        ...(immersed ? { clipPath: 'inset(50%)' } : {}),
        // Studio wall: a soft key light from the upper left, falling off to the right.
        background: [
          'radial-gradient(ellipse 60% 70% at 18% 4%, rgba(255,253,246,0.95), rgba(255,253,246,0) 70%)',
          'radial-gradient(ellipse 50% 60% at 100% 45%, rgba(120,98,70,0.10), rgba(120,98,70,0) 70%)',
          'linear-gradient(180deg, #f4efe4 0%, #ece5d7 100%)',
        ].join(', '),
      }}
      className={immersed ? 'absolute inset-0 z-10 overflow-hidden' : 'relative min-h-[88svh] overflow-hidden md:min-h-screen'}
    >
      <div
        className="absolute inset-0 flex items-center justify-center pt-24 pb-16"
        style={immersed ? { transform: 'scale(calc(1.06 - 0.06 * var(--rack-reveal, 1)))', transformOrigin: '50% 40%' } : undefined}
      >
        <div
          className="relative"
          style={{
            width: 'min(94vw, calc((100svh - 10rem) * 1.8417))',
            aspectRatio: `${RACK_BOX.w} / ${RACK_BOX.h}`,
            containerType: 'size',
          }}
        >
          <StudioFloor />

          {/* Hook tips that pass behind the rod. */}
          <div className="pointer-events-none absolute inset-0 z-[1]">
            {slots.map((slot, index) => <Hook key={index} x={hangX(slot.position)} part="back" />)}
          </div>

          <div className="pointer-events-none absolute z-[2]" style={rackArtStyle}>
            <img
              src={RACK_SRC}
              alt="Silver standing garment rack"
              draggable={false}
              className="h-full w-full select-none"
              style={{ filter: 'drop-shadow(1.2cqw 1cqh 0.9cqw rgba(70,55,35,0.16))' }}
            />
            {/* Warm room bounce on the chrome, then a key-light sheen. */}
            <div className="absolute inset-0" style={{ ...rackMask, mixBlendMode: 'multiply', background: 'linear-gradient(180deg, rgba(236,222,196,0.45), rgba(214,196,166,0.55))' }} />
            <div className="absolute inset-0" style={{ ...rackMask, mixBlendMode: 'screen', background: 'linear-gradient(100deg, rgba(255,255,255,0) 8%, rgba(255,255,255,0.55) 20%, rgba(255,255,255,0) 31%, rgba(255,255,255,0) 64%, rgba(255,248,232,0.28) 74%, rgba(255,255,255,0) 84%)' }} />
          </div>

          <div className="absolute inset-0 z-[3]">
            {slots.map((slot, index) => {
              const piece = slot.piece
              const isSelected = !!piece && piece.id === selectedId
              const isHovered = hoveredId === (piece?.id ?? `empty-${index}`)
              const turn = isHovered || isSelected ? 0 : slot.outfitId && slot.outfitId === activeOutfitId ? SIBLING_DEG : SIDEWAYS_DEG
              return (
                <Hanger
                  key={piece?.id ?? `empty-${index}`}
                  x={hangX(slot.position)}
                  piece={piece}
                  url={piece ? urls.get(piece.id) : undefined}
                  turn={turn}
                  raised={isHovered || isSelected}
                  selected={isSelected}
                  onHover={(on) => setHoveredId((current) => on ? piece?.id ?? `empty-${index}` : current === (piece?.id ?? `empty-${index}`) ? null : current)}
                  onSelect={() => {
                    if (!piece) return
                    console.log('[rack] selected piece', { name: piece.name, outfit: outfitById.get(piece.outfitId)?.name })
                    setSelectedId((current) => current === piece.id ? null : piece.id)
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col-reverse gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6" style={chromeStyle}>
        <div className="pointer-events-auto">
          {selected
            ? <PieceDetails piece={selected} outfit={outfitById.get(selected.outfitId)} urls={urls} onClose={() => setSelectedId(null)} />
            : <p className="text-xs text-[#5d5446]/80">Hover a hanger to turn it forward · tap a piece to see its outfit</p>}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {status && <p aria-live="polite" className="max-w-xs rounded-full bg-white/80 px-3 py-1.5 text-right text-xs text-[#3f382e] shadow-sm backdrop-blur">{status}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={shuffle}
              disabled={busy}
              className="flex h-10 items-center gap-2 rounded-full bg-white/80 px-4 text-xs font-medium uppercase tracking-wider text-[#3f382e] shadow-sm backdrop-blur transition-colors hover:bg-white disabled:opacity-50"
            >
              <RefreshCw size={14} /> Shuffle
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex h-10 items-center gap-2 rounded-full bg-[#355f43] px-4 text-xs font-medium uppercase tracking-wider text-[#fffbd5] shadow-sm transition-colors hover:bg-[#2c5038] disabled:opacity-60"
            >
              <ImagePlus size={14} /> {busy ? 'Working…' : 'Add outfit photos'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              void upload(files)
            }}
          />
        </div>
      </div>
    </section>
  )
}

function hangX(position: number) {
  // A touch of irregularity so the row doesn't look machine-spaced.
  const jitter = Math.sin(position * 37.1) * 0.45
  return HANG_SPAN[0] + position * (HANG_SPAN[1] - HANG_SPAN[0]) + jitter
}

/** Object URLs for every uploaded cut-out on the rack, revoked when the rack changes. */
function useBlobUrls(outfits: RackOutfit[]) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    const next = new Map<string, string>()
    for (const piece of outfits.flatMap((outfit) => outfit.pieces)) {
      if (piece.blob) next.set(piece.id, URL.createObjectURL(piece.blob))
    }
    setUrls(next)
    return () => next.forEach((url) => URL.revokeObjectURL(url))
  }, [outfits])
  return urls
}

/** Floor plane and contact shadows, aligned to the rack's feet. */
function StudioFloor() {
  const foot = (x: number, y: number, w: number) => (
    <div
      className="absolute rounded-[50%]"
      style={{ left: `${x}cqw`, top: `${y}cqh`, width: `${w}cqw`, height: '1.4cqh', transform: 'translate(-40%, -50%)', background: 'radial-gradient(closest-side, rgba(38,28,18,0.55), rgba(38,28,18,0))', filter: 'blur(1px)' }}
    />
  )
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div
        className="absolute"
        style={{
          left: '-60cqw', right: '-60cqw', top: '86cqh', bottom: '-60cqh',
          background: 'linear-gradient(180deg, rgba(214,202,182,0) 0%, #ddd2bf 6%, #e5dccb 30%, #ede6d8 100%)',
        }}
      />
      {/* Broad ambient shadow under the rack, offset away from the key light. */}
      <div className="absolute" style={{ left: '2cqw', right: '-2cqw', top: '88cqh', height: '14cqh', background: 'radial-gradient(closest-side, rgba(70,54,34,0.22), rgba(70,54,34,0))', filter: 'blur(6px)' }} />
      {foot(1.1, 100, 4.5)}
      {foot(98.9, 100, 4.5)}
      {foot(5, 91.8, 2.6)}
      {foot(95.1, 91.8, 2.6)}
    </div>
  )
}

/**
 * The swivel hook, seen side-on: the stem rises in front of the rod, loops over
 * its top, and the tip drops down behind it. Drawn in rod-thickness units.
 */
function Hook({ x, part }: { x: number; part: 'front' | 'back' }) {
  return (
    <svg
      viewBox="0 0 3 2.2"
      aria-hidden="true"
      className="absolute overflow-visible"
      style={{ left: `${x}cqw`, top: `${HOOK_TOP}cqh`, height: `${2.2 * ROD_THICKNESS}cqh`, width: `${3 * ROD_THICKNESS}cqh`, transform: 'translateX(-50%)' }}
    >
      {part === 'front' ? <>
        <path d="M1.5 2.2 L1.5 0.9 C1.5 0.16 2.15 0.16 2.15 0.44" fill="none" stroke="#8d939a" strokeWidth="0.17" strokeLinecap="round" />
        <path d="M1.46 2.1 L1.46 0.9 C1.46 0.3 1.8 0.2 2.0 0.28" fill="none" stroke="#f4f6f8" strokeWidth="0.05" strokeLinecap="round" opacity="0.9" />
      </> : (
        <path d="M2.15 0.4 L2.15 1.3 Q2.15 1.62 1.92 1.56" fill="none" stroke="#7d838a" strokeWidth="0.17" strokeLinecap="round" />
      )}
    </svg>
  )
}

interface HangerProps {
  x: number
  piece: RackPiece | null
  url?: string
  turn: number
  raised: boolean
  selected: boolean
  onHover: (on: boolean) => void
  onSelect: () => void
}

function Hanger({ x, piece, url, turn, raised, selected, onHover, onSelect }: HangerProps) {
  const hangsFromBar = piece?.category === 'bottoms'
  const garmentTop = hangsFromBar ? `calc(var(--hw) * ${BAR_DEPTH})` : 'calc(var(--hw) * 0.035)'
  const garmentWidth = hangsFromBar ? 'calc(var(--hw) * 0.8)' : 'calc(var(--hw) * 1.06)'

  return (
    <div className={`absolute inset-0 ${raised ? 'z-20' : 'z-10'}`} style={{ pointerEvents: 'none' }}>
      <Hook x={x} part="front" />
      <div
        className="absolute"
        style={{ left: `${x}cqw`, top: `${NECK_TOP}cqh`, width: HANGER_WIDTH, transform: 'translateX(-50%)', perspective: '900px', ['--hw' as string]: HANGER_WIDTH }}
      >
        <button
          type="button"
          aria-label={piece ? `${piece.name}${selected ? ' (selected)' : ''}` : 'Empty hanger'}
          aria-pressed={piece ? selected : undefined}
          onClick={onSelect}
          onPointerEnter={(event) => { if (event.pointerType !== 'touch') onHover(true) }}
          onPointerLeave={(event) => { if (event.pointerType !== 'touch') onHover(false) }}
          onFocus={() => onHover(true)}
          onBlur={() => onHover(false)}
          className="relative block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#355f43]/60"
          style={{
            pointerEvents: 'auto',
            transform: `rotateY(${turn}deg)`,
            transformOrigin: '50% 0',
            transition: 'transform 760ms cubic-bezier(0.22, 0.8, 0.24, 1)',
            willChange: 'transform',
          }}
        >
          <div style={{ filter: 'drop-shadow(0.5cqw 1.1cqh 0.7cqw rgba(58,44,30,0.2))' }}>
            <img src="/images/wooden-hanger-body.png" alt="" aria-hidden="true" draggable={false} className="block w-full select-none" />
            {piece && (
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: garmentTop }}>
                {piece.sample
                  ? <SampleGarment kind={piece.sample.kind} colour={piece.sample.colour} id={piece.id} width={garmentWidth} sideways={turn / SIDEWAYS_DEG} />
                  : url && <PhotoGarment url={url} piece={piece} width={garmentWidth} sideways={turn / SIDEWAYS_DEG} />}
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  )
}

/** An uploaded cut-out with soft fabric shading laid over its own shape. */
function PhotoGarment({ url, piece, width, sideways }: { url: string; piece: RackPiece; width: string; sideways: number }) {
  const aspect = piece.width / Math.max(1, piece.height)
  const mask: CSSProperties = { WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }
  return (
    <div className="relative" style={{ width: `min(${width}, calc(66cqh * ${aspect}))`, aspectRatio: `${piece.width} / ${piece.height}` }}>
      <img src={url} alt="" draggable={false} className="block h-full w-full select-none" />
      <div
        className="absolute inset-0"
        style={{
          ...mask,
          background: 'linear-gradient(100deg, rgba(255,250,240,0.18) 0%, rgba(255,250,240,0) 38%, rgba(34,24,14,0.2) 100%), linear-gradient(180deg, rgba(34,24,14,0) 55%, rgba(34,24,14,0.14) 100%)',
          opacity: 0.55 + 0.45 * sideways,
          transition: 'opacity 760ms ease',
        }}
      />
    </div>
  )
}

const SAMPLE_PATHS: Record<SampleGarmentKind, { d: string; top: number; bottom: number; trim?: string }> = {
  top: { d: 'M42 30Q56 41 70 30L97 37L110 80L95 86L92 72V200Q56 206 20 200V72L17 86L2 80L15 37Z', top: 28, bottom: 206, trim: 'M42 30Q56 47 70 30' },
  coat: { d: 'M41 30Q56 37 71 30L99 38L108 222L95 224L92 92L95 322H17L20 92L17 224L4 222L13 38Z', top: 28, bottom: 324, trim: 'M50 32L42 72L56 132M62 32L70 72L56 132V322' },
  dress: { d: 'M40 30Q56 42 72 30L82 36L80 72L77 110Q99 240 105 360Q56 372 7 360Q13 240 35 110L32 72L30 36Z', top: 28, bottom: 368, trim: 'M35 110Q56 116 77 110' },
  bottom: { d: 'M23 34H89L95 370H62L56 118L50 370H17Z', top: 32, bottom: 372, trim: 'M23 44H89' },
  skirt: { d: 'M30 34H82L104 298Q56 310 8 298Z', top: 32, bottom: 308, trim: 'M30 44H82' },
}

/** Drawn garments for the built-in sample outfits. */
function SampleGarment({ id, kind, colour, width, sideways }: { id: string; kind: SampleGarmentKind; colour: string; width: string; sideways: number }) {
  const { d, top, bottom, trim } = SAMPLE_PATHS[kind]
  const height = bottom - top
  return (
    <svg viewBox={`0 ${top} 112 ${height}`} style={{ width: `min(${width}, calc(66cqh * ${112 / height}))` }} className="block overflow-visible" aria-hidden="true">
      <defs>
        {/* Key light from the left: a soft highlight falling off into shade. */}
        <linearGradient id={`light-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".35" stopColor="#fff" stopOpacity="0" />
          <stop offset=".7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#1d140c" stopOpacity=".2" />
        </linearGradient>
        <linearGradient id={`shade-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#1d140c" stopOpacity=".2" />
        </linearGradient>
        <linearGradient id={`folds-${id}`} x1="0" x2="1" y1="0" y2="0">
          {[0.2, 0.38, 0.55, 0.72].map((at) => [
            <stop key={`${at}a`} offset={at - 0.05} stopColor="#000" stopOpacity="0" />,
            <stop key={`${at}b`} offset={at} stopColor="#000" stopOpacity=".09" />,
            <stop key={`${at}c`} offset={at + 0.05} stopColor="#000" stopOpacity="0" />,
          ])}
        </linearGradient>
      </defs>
      <path d={d} fill={colour} stroke="#1d140c" strokeOpacity=".12" strokeWidth="0.8" strokeLinejoin="round" />
      <path d={d} fill={`url(#light-${id})`} />
      <path d={d} fill={`url(#folds-${id})`} />
      <path d={d} fill={`url(#shade-${id})`} style={{ opacity: 0.6 + 0.4 * sideways, transition: 'opacity 760ms ease' }} />
      {trim && <path d={trim} fill="none" stroke="#1d140c" strokeOpacity=".18" strokeWidth="1.2" strokeLinecap="round" />}
    </svg>
  )
}

function PieceThumb({ piece, url }: { piece: RackPiece; url?: string }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f3eee4]">
      {url
        ? <img src={url} alt="" className="max-h-full max-w-full object-contain p-1" />
        : <span className="h-6 w-6 rounded-full" style={{ background: piece.sample?.colour ?? '#cfc6b6' }} />}
    </div>
  )
}

const CATEGORY_LABEL: Record<string, string> = {
  tops: 'Top', bottoms: 'Bottoms', dresses: 'Dress', outerwear: 'Outerwear', shoes: 'Shoes', accessories: 'Accessory',
}

function PieceDetails({ piece, outfit, urls, onClose }: { piece: RackPiece; outfit?: RackOutfit; urls: Map<string, string>; onClose: () => void }) {
  const accessories = outfit ? accessoryPieces(outfit) : []
  const alsoHanging = outfit ? outfit.pieces.filter((other) => other.id !== piece.id && !accessories.includes(other)) : []
  return (
    <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white/90 p-4 text-[#2f2a22] shadow-[0_12px_40px_rgba(60,45,28,0.18)] backdrop-blur">
      <div className="flex items-start gap-3">
        <PieceThumb piece={piece} url={urls.get(piece.id)} />
        <div className="min-w-0 flex-1">
          <p className="text-2xs uppercase tracking-widest text-[#7a6f5e]">{CATEGORY_LABEL[piece.category] ?? piece.category}</p>
          <h3 className="truncate font-brand text-lg leading-tight">{piece.name}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[#7a6f5e] hover:bg-black/5">
          <X size={16} />
        </button>
      </div>

      {accessories.length > 0 ? (
        <div className="mt-3">
          <p className="mb-2 text-2xs uppercase tracking-widest text-[#7a6f5e]">Worn with, from the same photo</p>
          <ul className="flex flex-wrap gap-2">
            {accessories.map((accessory) => (
              <li key={accessory.id} className="flex items-center gap-2 rounded-xl bg-[#f6f2ea] py-1 pl-1 pr-3 text-xs">
                <PieceThumb piece={accessory} url={urls.get(accessory.id)} />
                {accessory.name}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[#5d5446]">
          <span className="text-2xs uppercase tracking-widest text-[#7a6f5e]">Outfit · </span>{outfit?.name ?? 'Untitled outfit'}
        </p>
      )}

      {alsoHanging.length > 0 && (
        <p className="mt-2 text-xs text-[#5d5446]">Also in this look: {alsoHanging.map((other) => other.name).join(', ')}</p>
      )}
      {outfit?.sample && <p className="mt-2 text-2xs text-[#7a6f5e]">Sample outfit. Add your own photos to fill the rack.</p>}
    </div>
  )
}

