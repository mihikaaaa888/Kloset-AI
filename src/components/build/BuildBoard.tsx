import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowUpToLine, Check, Minus, Plus, RotateCcw, RotateCw, Search, Trash2, X } from 'lucide-react'
import { clsx } from 'clsx'

import { useItemImage } from '@/hooks/useItemImage'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useUserStore } from '@/store/userStore'
import { useOutfitStore } from '@/store/outfitStore'
import { useBoardStore, type BoardPiece } from '@/store/boardStore'
import { deleteWithUndo } from '@/store/undoStore'
import { CATALOG_ITEMS } from '@/lib/catalogData'
import { formatINR, rankForUser } from '@/lib/shopping'
import { ROLE_FOR_CATEGORY } from '@/lib/outfitPieces'
import { colourNameToHex, isLightColour } from '@/lib/colourUtils'
import { CategoryGlyph } from '@/components/wardrobe/categoryVisuals'
import type { ClothingCategory, ClothingItem, Occasion, Outfit, OutfitItem } from '@/types'

// ─── Drawer sources ───────────────────────────────────────────────────────────

type Source = BoardPiece['source']

const SOURCES: { id: Source; label: string }[] = [
  { id: 'kloset', label: 'My Kloset' },
  { id: 'shop', label: 'Shop' },
  { id: 'inspiration', label: 'Inspiration' },
]

type Filter = ClothingCategory | 'all' | 'bags'

const FILTERS: { id: Filter; label: string; category: ClothingCategory; query: string }[] = [
  { id: 'all', label: 'All', category: 'accessories', query: 'aesthetic outfit flat lay' },
  { id: 'tops', label: 'Tops', category: 'tops', query: 'blouse top flat lay' },
  { id: 'bottoms', label: 'Bottoms', category: 'bottoms', query: 'jeans trousers flat lay' },
  { id: 'dresses', label: 'Dresses', category: 'dresses', query: 'dress on hanger' },
  { id: 'outerwear', label: 'Outerwear', category: 'outerwear', query: 'coat jacket on hanger' },
  { id: 'shoes', label: 'Shoes', category: 'shoes', query: 'shoes product photo' },
  { id: 'bags', label: 'Bags', category: 'accessories', query: 'handbag product photo' },
  { id: 'accessories', label: 'Accessories', category: 'accessories', query: 'jewelry sunglasses minimal' },
]

const BAG_PATTERN = /\b(bag|tote|clutch|purse|backpack|satchel|crossbody)\b/i

function matchesFilter(filter: Filter, category: ClothingCategory, name: string, subcategory?: string): boolean {
  if (filter === 'all') return true
  if (filter === 'bags') return category === 'accessories' && BAG_PATTERN.test(`${name} ${subcategory ?? ''}`)
  return category === filter
}

/** Something in the drawer that can be pinned to the board. */
interface Candidate {
  key: string
  itemId: string
  source: Source
  name: string
  category: ClothingCategory
  imageUrl: string | null
  colour: string[]
  catalogId?: string
  item?: ClothingItem
  caption?: string
}

interface PexelsPhoto {
  id: number
  url: string
  thumbUrl: string
  alt: string
  photographer: string
}

const DRAG_MIME = 'application/x-kloset-piece'

const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'work', label: 'Work' },
  { value: 'date-night', label: 'Date night' },
  { value: 'formal', label: 'Formal' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'travel', label: 'Travel' },
  { value: 'special-event', label: 'Special event' },
  { value: 'gym', label: 'Gym' },
]

const MIN_W = 0.08
const MAX_W = 0.7
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// ─── Board ────────────────────────────────────────────────────────────────────

/**
 * A free-form cork board: pin pieces from your Kloset, the shop, or inspiration
 * photos, then drag, resize and tilt them into an outfit.
 */
export function BuildBoard({ onSaved }: { onSaved: () => void }) {
  const wardrobe = useWardrobeStore((s) => s.items)
  const saveOutfit = useOutfitStore((s) => s.saveOutfit)
  const { pieces: storedPieces, setPieces: storePieces } = useBoardStore()

  // Local copy so dragging doesn't write to localStorage on every frame; committed on release.
  const [pieces, setPieces] = useState<BoardPiece[]>(storedPieces)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{
    id: string
    mode: 'move' | 'resize'
    startX: number
    startY: number
    piece: BoardPiece
    rect: DOMRect
  } | null>(null)

  // Picks up changes made from outside the board, like Undo putting a piece back.
  useEffect(() => {
    if (!gesture.current) setPieces(storedPieces)
  }, [storedPieces])

  const commit = useCallback((next: BoardPiece[]) => {
    setPieces(next)
    storePieces(next)
  }, [storePieces])

  const wardrobeById = useMemo(() => new Map(wardrobe.map((i) => [i.id, i])), [wardrobe])
  const selected = pieces.find((p) => p.id === selectedId) ?? null
  const topZ = pieces.reduce((z, p) => Math.max(z, p.z), 0)

  const addPiece = (c: Candidate, at?: { x: number; y: number }) => {
    const boardWidth = boardRef.current?.clientWidth ?? 600
    const piece: BoardPiece = {
      id: crypto.randomUUID(),
      itemId: c.itemId,
      source: c.source,
      name: c.name,
      category: c.category,
      imageUrl: c.imageUrl,
      colour: c.colour,
      catalogId: c.catalogId,
      x: at?.x ?? 0.5 + (Math.random() - 0.5) * 0.35,
      y: at?.y ?? 0.5 + (Math.random() - 0.5) * 0.3,
      w: clamp(170 / boardWidth, 0.16, 0.42),
      rotation: Math.round((Math.random() - 0.5) * 8),
      z: topZ + 1,
    }
    console.log('[build] pinned piece', { source: c.source, itemId: c.itemId })
    commit([...pieces, piece])
    setSelectedId(piece.id)
  }

  const updatePiece = (id: string, patch: Partial<BoardPiece>, persist = true) => {
    const next = pieces.map((p) => (p.id === id ? { ...p, ...patch } : p))
    if (persist) commit(next)
    else setPieces(next)
  }

  // Undo can fire after this screen has closed, so put pieces back through the store.
  const removeWithUndo = (removed: BoardPiece[], message: string) => {
    const ids = new Set(removed.map((p) => p.id))
    deleteWithUndo({
      message,
      remove: () => {
        commit(pieces.filter((p) => !ids.has(p.id)))
        setSelectedId(null)
      },
      restore: () => {
        const current = useBoardStore.getState().pieces.filter((p) => !ids.has(p.id))
        useBoardStore.getState().setPieces([...current, ...removed])
      },
    })
  }

  const removePiece = (id: string) => {
    const piece = pieces.find((p) => p.id === id)
    if (piece) removeWithUndo([piece], `Removed ${piece.name} from the board`)
  }

  // ── Pointer gestures (mouse + touch) ──
  const startGesture = (e: PointerEvent, piece: BoardPiece, mode: 'move' | 'resize') => {
    if (!boardRef.current) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedId(piece.id)
    const raised = piece.z < topZ ? { ...piece, z: topZ + 1 } : piece
    if (raised !== piece) updatePiece(piece.id, { z: raised.z }, false)
    gesture.current = { id: piece.id, mode, startX: e.clientX, startY: e.clientY, piece: raised, rect: boardRef.current.getBoundingClientRect() }
  }

  const moveGesture = (e: PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dx = (e.clientX - g.startX) / g.rect.width
    const dy = (e.clientY - g.startY) / g.rect.height
    if (g.mode === 'move') {
      updatePiece(g.id, { x: clamp(g.piece.x + dx, 0, 1), y: clamp(g.piece.y + dy, 0, 1) }, false)
    } else {
      // The piece is centred on (x, y), so the corner moves half as far as the width grows.
      updatePiece(g.id, { w: clamp(g.piece.w + dx * 2, MIN_W, MAX_W) }, false)
    }
  }

  const endGesture = () => {
    if (!gesture.current) return
    gesture.current = null
    storePieces(pieces)
  }

  const onPieceKey = (e: KeyboardEvent, piece: BoardPiece) => {
    const step = e.shiftKey ? 0.05 : 0.01
    const moves: Record<string, Partial<BoardPiece>> = {
      ArrowLeft: { x: clamp(piece.x - step, 0, 1) },
      ArrowRight: { x: clamp(piece.x + step, 0, 1) },
      ArrowUp: { y: clamp(piece.y - step, 0, 1) },
      ArrowDown: { y: clamp(piece.y + step, 0, 1) },
      '+': { w: clamp(piece.w + 0.02, MIN_W, MAX_W) },
      '=': { w: clamp(piece.w + 0.02, MIN_W, MAX_W) },
      '-': { w: clamp(piece.w - 0.02, MIN_W, MAX_W) },
    }
    if (moves[e.key]) {
      e.preventDefault()
      updatePiece(piece.id, moves[e.key])
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removePiece(piece.id)
    } else if (e.key === 'Escape') {
      setSelectedId(null)
    }
  }

  // ── Drop from the drawer (desktop drag and drop) ──
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDropActive(false)
    const raw = e.dataTransfer.getData(DRAG_MIME)
    if (!raw || !boardRef.current) return
    const rect = boardRef.current.getBoundingClientRect()
    addPiece(JSON.parse(raw) as Candidate, {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    })
  }

  // ── Save as outfit ──
  const handleSave = (name: string, occasion: Occasion) => {
    const seen = new Set<string>()
    const items: OutfitItem[] = []
    for (const p of [...pieces].sort((a, b) => a.z - b.z)) {
      if (seen.has(p.itemId)) continue
      seen.add(p.itemId)
      items.push({
        itemId: p.itemId,
        role: ROLE_FOR_CATEGORY[p.category],
        ...(p.source !== 'kloset' && {
          snapshot: { source: p.source, name: p.name, category: p.category, imageUrl: p.imageUrl, colour: p.colour, catalogId: p.catalogId },
        }),
      })
    }
    const now = new Date().toISOString()
    const outfit: Outfit = {
      id: crypto.randomUUID(),
      name: name.trim() || `${OCCASIONS.find((o) => o.value === occasion)?.label} look`,
      items,
      occasion,
      stylingNotes: '',
      whyItWorks: '',
      generatedAt: now,
      isSaved: true,
      source: 'manual',
    }
    saveOutfit(outfit)
    console.log('[build] saved board as outfit', { id: outfit.id, pieces: items.length })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 lg:gap-8">
      {/* ── Board column ── */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-3 min-h-11">
          <p className="text-2xs uppercase tracking-widest text-text-muted">
            {pieces.length === 0 ? 'Your board' : `${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'} pinned`}
          </p>
          {pieces.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => removeWithUndo(pieces, 'Board cleared')}
                className="h-11 px-4 text-2xs uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setSaving(true)}
                className="h-11 px-5 flex items-center gap-2 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90 transition-colors"
              >
                <Check size={14} strokeWidth={1.5} />
                Save<span className="hidden sm:inline"> as outfit</span>
              </button>
            </div>
          )}
        </div>

        {saving && <SavePanel onCancel={() => setSaving(false)} onSave={handleSave} />}

        {/* Wooden frame around the cork */}
        <div className="p-2 sm:p-3 bg-[#7A5A3C] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25),0_10px_30px_rgba(36,27,41,0.18)]">
          <div
            ref={boardRef}
            onPointerDown={() => setSelectedId(null)}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); setDropActive(true) } }}
            onDragLeave={() => setDropActive(false)}
            onDrop={onDrop}
            className={clsx(
              'cork relative overflow-hidden aspect-[4/5] sm:aspect-[4/3] lg:aspect-auto lg:h-[72vh] lg:min-h-[540px] select-none',
              dropActive && 'outline outline-2 outline-offset-[-6px] outline-warm-cream/80'
            )}
          >
            {pieces.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                <div className="bg-warm-cream px-6 py-5 max-w-xs text-center rotate-[-1.5deg] shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
                  <p className="font-display text-2xl text-text-primary leading-tight">Pin pieces here</p>
                  <p className="text-xs text-text-muted mt-2 leading-relaxed">
                    Tap or drag anything from your Kloset, the shop or inspiration. Move, resize and tilt them until the outfit works.
                  </p>
                </div>
              </div>
            )}

            {pieces.map((piece) => (
              <PinnedPiece
                key={piece.id}
                piece={piece}
                item={piece.source === 'kloset' ? wardrobeById.get(piece.itemId) : undefined}
                selected={piece.id === selectedId}
                onPointerDown={(e) => startGesture(e, piece, 'move')}
                onResizeStart={(e) => startGesture(e, piece, 'resize')}
                onKeyDown={(e) => onPieceKey(e, piece)}
                onFocus={() => setSelectedId(piece.id)}
              />
            ))}
          </div>
        </div>

        {/* Controls for the selected piece */}
        <div className="h-14 mt-3 flex items-center justify-center">
          {selected ? (
            <div className="flex items-center gap-1 bg-warm-cream ring-1 ring-text-primary/15 px-1.5 animate-fade-in">
              <span className="hidden sm:block max-w-[180px] truncate px-2 text-xs text-text-primary">{selected.name}</span>
              <ToolButton label="Smaller" onClick={() => updatePiece(selected.id, { w: clamp(selected.w - 0.04, MIN_W, MAX_W) })}><Minus size={16} strokeWidth={1.25} /></ToolButton>
              <ToolButton label="Bigger" onClick={() => updatePiece(selected.id, { w: clamp(selected.w + 0.04, MIN_W, MAX_W) })}><Plus size={16} strokeWidth={1.25} /></ToolButton>
              <ToolButton label="Tilt left" onClick={() => updatePiece(selected.id, { rotation: selected.rotation - 5 })}><RotateCcw size={16} strokeWidth={1.25} /></ToolButton>
              <ToolButton label="Tilt right" onClick={() => updatePiece(selected.id, { rotation: selected.rotation + 5 })}><RotateCw size={16} strokeWidth={1.25} /></ToolButton>
              <ToolButton label="Bring to front" onClick={() => updatePiece(selected.id, { z: topZ + 1 })}><ArrowUpToLine size={16} strokeWidth={1.25} /></ToolButton>
              <ToolButton label="Remove" onClick={() => removePiece(selected.id)} danger><Trash2 size={16} strokeWidth={1.25} /></ToolButton>
            </div>
          ) : pieces.length > 0 ? (
            <p className="text-xs text-text-muted">Tap a piece to resize, tilt or remove it.</p>
          ) : null}
        </div>
      </div>

      {/* ── Drawer ── */}
      <PieceDrawer wardrobe={wardrobe} onPick={(c) => addPiece(c)} />
    </div>
  )
}

function ToolButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'w-11 h-11 flex items-center justify-center text-text-primary transition-colors',
        danger ? 'hover:text-red-700' : 'hover:bg-text-primary/5'
      )}
    >
      {children}
    </button>
  )
}

// ─── A pinned piece ───────────────────────────────────────────────────────────

function PinnedPiece({
  piece,
  item,
  selected,
  onPointerDown,
  onResizeStart,
  onKeyDown,
  onFocus,
}: {
  piece: BoardPiece
  item?: ClothingItem
  selected: boolean
  onPointerDown: (e: PointerEvent) => void
  onResizeStart: (e: PointerEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
  onFocus: () => void
}) {
  const klosetUrl = useItemImage(item)
  const src = piece.source === 'kloset' ? klosetUrl ?? piece.imageUrl : piece.imageUrl
  const bgHex = piece.colour[0] ? colourNameToHex(piece.colour[0]) : '#EDE9E2'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${piece.name}. Arrow keys move it, plus and minus resize, Delete removes.`}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className="absolute touch-none cursor-grab active:cursor-grabbing focus-visible:outline-none"
      style={{
        left: `${piece.x * 100}%`,
        top: `${piece.y * 100}%`,
        width: `${piece.w * 100}%`,
        zIndex: piece.z,
        transform: `translate(-50%, -50%) rotate(${piece.rotation}deg)`,
      }}
    >
      <div
        className={clsx(
          'relative bg-white p-[5%] pb-[14%] shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition-shadow',
          selected && 'shadow-[0_14px_30px_rgba(0,0,0,0.35)] ring-2 ring-butter-yellow'
        )}
      >
        {/* Pin */}
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[radial-gradient(circle_at_35%_35%,#E8D5B0,#9C2F2F_55%,#5E1A1A)] shadow-[0_2px_3px_rgba(0,0,0,0.4)]" />
        {src ? (
          <img src={src} alt="" draggable={false} className="block w-full aspect-[3/4] object-cover pointer-events-none" />
        ) : (
          <div className="w-full aspect-[3/4] flex items-center justify-center" style={{ backgroundColor: bgHex }}>
            <CategoryGlyph category={piece.category} size={40} className={isLightColour(bgHex) ? 'text-text-primary/35' : 'text-white/45'} />
          </div>
        )}
        <p className="absolute left-[5%] right-[5%] bottom-[3%] truncate text-[10px] leading-tight text-[#241B29]/80 font-display">
          {piece.name}
        </p>
        {selected && (
          <span
            onPointerDown={onResizeStart}
            aria-hidden
            className="absolute -bottom-2.5 -right-2.5 w-6 h-6 rounded-full bg-butter-yellow ring-2 ring-white cursor-nwse-resize touch-none"
          />
        )}
      </div>
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function PieceDrawer({ wardrobe, onPick }: { wardrobe: ClothingItem[]; onPick: (c: Candidate) => void }) {
  const profile = useUserStore((s) => s.profile)
  const [source, setSource] = useState<Source>(wardrobe.length > 0 ? 'kloset' : 'shop')
  const [filter, setFilter] = useState<Filter>('all')

  const candidates = useMemo<Candidate[]>(() => {
    if (source === 'kloset') {
      return wardrobe
        .filter((i) => matchesFilter(filter, i.category, i.name, i.subcategory))
        .map((i) => ({
          key: i.id,
          itemId: i.id,
          source: 'kloset',
          name: i.name,
          category: i.category,
          imageUrl: i.imageUrl,
          colour: i.colour,
          item: i,
        }))
    }
    if (source === 'shop') {
      return rankForUser(CATALOG_ITEMS, profile, wardrobe)
        .filter((c) => matchesFilter(filter, c.category, c.name, c.subcategory))
        .map((c) => ({
          key: c.id,
          itemId: c.id,
          source: 'shop',
          name: c.name,
          category: c.category,
          imageUrl: c.imageUrl,
          colour: c.colours,
          catalogId: c.id,
          caption: formatINR(c.estimatedPrice),
        }))
    }
    return []
  }, [source, filter, wardrobe, profile])

  return (
    <aside className="lg:sticky lg:top-24 self-start min-w-0 lg:h-[calc(72vh+4.5rem)] lg:min-h-[600px] flex flex-col border-t lg:border-t-0 lg:border-l border-text-primary/10 pt-6 lg:pt-0 lg:pl-6">
      <div role="tablist" aria-label="Pieces from" className="flex gap-6 border-b border-text-primary/10">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={source === s.id}
            onClick={() => setSource(s.id)}
            className={clsx(
              'relative -mb-px pb-3 text-2xs uppercase tracking-widest transition-colors',
              source === s.id
                ? 'text-text-primary font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-text-primary'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar py-3.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx('text-tab flex-shrink-0 !text-2xs', filter === f.id && 'text-tab-active')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mr-2 pr-2 max-h-[60vh] lg:max-h-none">
        {source === 'inspiration' ? (
          <InspirationResults filter={filter} onPick={onPick} />
        ) : candidates.length === 0 ? (
          <p className="text-sm text-text-muted py-6">
            {source === 'kloset' && wardrobe.length === 0
              ? 'Your Kloset is empty. Pull from the shop or inspiration instead.'
              : 'Nothing here in this category.'}
          </p>
        ) : (
          <CandidateGrid candidates={candidates} onPick={onPick} />
        )}
      </div>
      <p className="hidden lg:block text-2xs text-text-muted pt-3">Tap to pin, or drag onto the board.</p>
    </aside>
  )
}

function CandidateGrid({ candidates, onPick }: { candidates: Candidate[]; onPick: (c: Candidate) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-3 pb-4">
      {candidates.map((c) => (
        <CandidateTile key={c.key} candidate={c} onPick={() => onPick(c)} />
      ))}
    </div>
  )
}

function CandidateTile({ candidate, onPick }: { candidate: Candidate; onPick: () => void }) {
  const klosetUrl = useItemImage(candidate.item)
  const src = candidate.item ? klosetUrl : candidate.imageUrl
  const bgHex = candidate.colour[0] ? colourNameToHex(candidate.colour[0]) : '#EDE9E2'

  return (
    <button
      onClick={onPick}
      draggable
      onDragStart={(e) => {
        // The wardrobe item itself stays behind; the board looks Kloset pieces up by id.
        const { item: _item, ...rest } = candidate
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(rest))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className="group text-left"
      title={`Pin ${candidate.name}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-tile ring-1 ring-inset ring-text-primary/5 group-hover:ring-text-primary/30 transition-shadow">
        {src ? (
          <img src={src} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgHex }}>
            <CategoryGlyph category={candidate.category} size={28} className={isLightColour(bgHex) ? 'text-text-primary/35' : 'text-white/45'} />
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-warm-cream/90 flex items-center justify-center text-text-primary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
          <Plus size={14} strokeWidth={1.5} />
        </span>
      </div>
      <p className="text-[11px] text-text-primary truncate mt-1.5">{candidate.name}</p>
      {candidate.caption && <p className="text-[11px] text-text-muted truncate tabular-nums">{candidate.caption}</p>}
    </button>
  )
}

// ─── Inspiration (stock photos) ───────────────────────────────────────────────

function InspirationResults({ filter, onPick }: { filter: Filter; onPick: (c: Candidate) => void }) {
  const preset = FILTERS.find((f) => f.id === filter)!
  const [input, setInput] = useState('')
  const [query, setQuery] = useState(preset.query)
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Switching category starts a fresh search for it.
  useEffect(() => {
    setInput('')
    setQuery(preset.query)
  }, [preset.query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage(null)
    fetch(`/api/search-images?q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.noKey) { setMessage('Inspiration search isn’t set up yet (add PEXELS_API_KEY).'); setPhotos([]); return }
        setPhotos(data.photos ?? [])
        if (!data.photos?.length) setMessage(data.error ?? 'No photos found. Try another search.')
      })
      .catch(() => { if (!cancelled) { setPhotos([]); setMessage('Couldn’t load inspiration photos right now.') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query])

  const candidates: Candidate[] = photos.map((p) => ({
    key: `pexels-${p.id}`,
    itemId: `pexels-${p.id}`,
    source: 'inspiration',
    name: p.alt ? p.alt.charAt(0).toUpperCase() + p.alt.slice(1) : 'Inspiration',
    category: preset.category,
    imageUrl: p.url,
    colour: [],
    caption: `Photo: ${p.photographer}`,
  }))

  return (
    <>
      <form
        onSubmit={(e) => { e.preventDefault(); if (input.trim()) setQuery(input.trim()) }}
        className="relative mb-4"
      >
        <Search size={15} strokeWidth={1.25} className="absolute left-0 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Search ${preset.label === 'All' ? 'aesthetic pieces' : preset.label.toLowerCase()}…`}
          className="w-full pl-6 pr-8 py-2.5 border-b border-text-primary/25 focus:border-text-primary bg-transparent text-base sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors"
        />
        {input && (
          <button type="button" onClick={() => { setInput(''); setQuery(preset.query) }} aria-label="Clear search" className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary">
            <X size={15} strokeWidth={1.25} />
          </button>
        )}
      </form>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[3/4] bg-text-primary/5 animate-pulse" />)}
        </div>
      ) : message ? (
        <p className="text-sm text-text-muted py-6">{message}</p>
      ) : (
        <CandidateGrid candidates={candidates} onPick={onPick} />
      )}
      <p className="text-2xs text-text-muted/70 pb-2">Inspiration photos from Pexels.</p>
    </>
  )
}

// ─── Save panel ───────────────────────────────────────────────────────────────

function SavePanel({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string, occasion: Occasion) => void }) {
  const [name, setName] = useState('')
  const [occasion, setOccasion] = useState<Occasion>('casual')

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(name, occasion) }}
      className="mb-4 p-4 sm:p-5 ring-1 ring-inset ring-text-primary/15 bg-warm-cream flex flex-col sm:flex-row sm:items-end gap-4 animate-fade-up"
    >
      <label className="flex-1 min-w-0">
        <span className="text-2xs uppercase tracking-widest text-text-muted">Outfit name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sunday brunch"
          maxLength={60}
          className="mt-1 w-full bg-transparent border-b border-text-primary/25 focus:border-text-primary py-1.5 font-display text-xl text-text-primary placeholder:text-text-muted/50 focus:outline-none"
        />
      </label>
      <label>
        <span className="text-2xs uppercase tracking-widest text-text-muted">Occasion</span>
        <select
          value={occasion}
          onChange={(e) => setOccasion(e.target.value as Occasion)}
          className="mt-1 block w-full sm:w-44 h-11 bg-transparent border-b border-text-primary/25 text-base sm:text-sm text-text-primary focus:outline-none focus:border-text-primary"
        >
          {OCCASIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-11 px-4 text-2xs uppercase tracking-widest text-text-muted hover:text-text-primary">
          Cancel
        </button>
        <button type="submit" className="h-11 px-6 bg-text-primary text-warm-cream text-xs font-medium uppercase tracking-widest hover:bg-text-primary/90">
          Save
        </button>
      </div>
    </form>
  )
}
