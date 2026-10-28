import { useState } from 'react'
import type { RefObject } from 'react'

type RackPiece = {
  id: string
  name: string
  kind: 'top' | 'bottom' | 'coat' | 'dress' | 'skirt'
  colour: string
  left: number
}

const INITIAL_PIECES: RackPiece[] = [
  { id: 'coat', name: 'The everyday layer', kind: 'coat', colour: '#526b5d', left: 20.25 },
  { id: 'top', name: 'A favourite top', kind: 'top', colour: '#d6b871', left: 28.75 },
  { id: 'dress', name: 'The one-piece look', kind: 'dress', colour: '#a8614e', left: 37.25 },
  { id: 'bottom', name: 'A good pair of trousers', kind: 'bottom', colour: '#64516f', left: 45.75 },
  { id: 'jacket', name: 'A polished jacket', kind: 'coat', colour: '#45566b', left: 54.25 },
  { id: 'skirt', name: 'A favourite skirt', kind: 'skirt', colour: '#a36c70', left: 62.75 },
  { id: 'shirt', name: 'A relaxed shirt', kind: 'top', colour: '#788895', left: 71.25 },
  { id: 'trousers', name: 'A tailored pair', kind: 'bottom', colour: '#8b755e', left: 79.75 },
]

interface InteractiveRackHeroProps {
  onRackInteract?: () => void
  immersed?: boolean
  sceneRef?: RefObject<HTMLDivElement>
}

/** A lightweight, interactive landing hero built around the user's real rack. */
export function InteractiveRackHero({ onRackInteract, immersed = false, sceneRef }: InteractiveRackHeroProps) {
  const [pieces, setPieces] = useState(INITIAL_PIECES)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const selectPiece = (id: string) => {
    setSelectedId(id)
    onRackInteract?.()
  }

  const movePiece = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    setPieces((current) => {
      const from = current.findIndex((piece) => piece.id === draggedId)
      const to = current.findIndex((piece) => piece.id === targetId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [piece] = next.splice(from, 1)
      next.splice(to, 0, piece)
      return next.map((item, index) => ({ ...item, left: 20.25 + index * 8.5 }))
    })
    setDraggedId(null)
    onRackInteract?.()
  }

  return (
    <section
      ref={sceneRef}
      style={{
        ...(immersed ? { clipPath: 'inset(50%)' } : {}),
        background: 'radial-gradient(ellipse at 24% 10%, rgba(255,255,255,.82), transparent 48%), linear-gradient(180deg, #faf8f1 0%, #f4f0e7 76%, #e9e2d5 100%)',
      }}
      className={immersed
        ? 'absolute inset-0 z-10 overflow-hidden bg-warm-cream'
        : 'relative min-h-[88svh] overflow-hidden bg-warm-cream px-3 pt-20 pb-8 md:min-h-screen md:px-8 md:pt-8'}
    >
      {!immersed && <>
        <div className="pointer-events-none absolute -left-36 top-1/4 h-96 w-96 rounded-full bg-butter-yellow/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-butter-yellow/10 blur-3xl" />
      </>}

      <div className={`relative z-10 mx-auto flex w-full items-center justify-center ${immersed ? 'h-full px-2 sm:px-4' : 'min-h-[80svh] md:min-h-[90svh]'}`}>
        <div className="relative aspect-[2/1] w-[min(96vw,172svh)]">
          {/* The cutout sits in front of the garments so the metal rail reads naturally. */}
          <div className="absolute inset-0" style={{ perspective: '1100px' }}>
            {pieces.map((piece, index) => {
              const selected = selectedId === piece.id
              const facing = hoveredId === piece.id || (!hoveredId && selected)
              return (
                <button
                  key={piece.id}
                  type="button"
                  draggable
                  aria-label={`Select or move ${piece.name}`}
                  onClick={() => selectPiece(piece.id)}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch') setHoveredId(piece.id)
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== 'touch') setHoveredId((current) => current === piece.id ? null : current)
                  }}
                  onFocus={() => setHoveredId(piece.id)}
                  onBlur={() => setHoveredId((current) => current === piece.id ? null : current)}
                  onDragStart={(event) => {
                    setDraggedId(piece.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', piece.id)
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    movePiece(piece.id)
                  }}
                  className={`group absolute top-[2.5%] block w-[clamp(42px,7.8vw,118px)] rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-text-primary/50 ${hoveredId === piece.id || selected ? 'z-30' : 'z-20'} ${draggedId === piece.id ? 'opacity-50' : 'opacity-100'}`}
                  style={{
                    left: `${piece.left}%`,
                    transform: 'translateX(-50%)',
                    animationDelay: `${index * 120}ms`,
                  }}
                >
                  <div
                    className="pointer-events-none relative flex w-full flex-col items-center"
                    style={{
                      transform: `translateY(${selected ? '-4px' : '0'}) rotateY(${facing ? 0 : 48}deg) scale(${selected ? 1.04 : 1})`,
                      transformOrigin: '50% 8%',
                      transformStyle: 'preserve-3d',
                      transition: 'transform 680ms cubic-bezier(0.2, 0.75, 0.2, 1)',
                      willChange: 'transform',
                    }}
                  >
                    <img
                      src="/images/wooden-hanger-cutout.png"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="pointer-events-none absolute left-0 top-0 z-0 w-full select-none object-contain drop-shadow-[0_5px_4px_rgba(44,35,26,0.1)]"
                    />
                    <GarmentShape id={piece.id} kind={piece.kind} colour={piece.colour} selected={selected} />
                  </div>
                </button>
              )
            })}
          </div>

          <img
            src="/images/landing-rack-wide-cutout.png"
            alt="Silver standing garment rack"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none object-contain drop-shadow-[0_18px_22px_rgba(47,39,28,0.18)]"
            draggable={false}
          />
          <div className="pointer-events-none absolute bottom-[8%] left-1/2 z-0 h-8 w-[72%] -translate-x-1/2 rounded-[50%] bg-[#665944]/20 blur-2xl" />
        </div>
      </div>
    </section>
  )
}

function GarmentShape({ id, kind, colour, selected }: { id: string; kind: RackPiece['kind']; colour: string; selected: boolean }) {
  const gradientId = `fabric-${id}`
  const fabric = selected ? 'opacity-100' : 'opacity-95'
  return (
    <svg viewBox="0 0 112 460" className={`relative z-10 w-full overflow-visible drop-shadow-[0_8px_9px_rgba(44,35,26,0.13)] ${fabric}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".13" />
          <stop offset=".22" stopColor={colour} />
          <stop offset=".76" stopColor={colour} />
          <stop offset="1" stopColor="#211b16" stopOpacity=".13" />
        </linearGradient>
      </defs>
      <g transform="translate(0 58)">
        {kind === 'top' && <path d="m40 31 16 5 16-5 20 13-10 18-10-6v154H40V56l-10 6-10-18 20-13Z" fill={`url(#${gradientId})`} stroke={colour} strokeOpacity=".38" strokeWidth="1.2" strokeLinejoin="round" />}
        {kind === 'coat' && <path d="m41 31 15 5 15-5 20 13-10 19-9-6v263H40V57l-9 6-10-19 20-13Z" fill={`url(#${gradientId})`} stroke={colour} strokeOpacity=".42" strokeWidth="1.2" strokeLinejoin="round" />}
        {kind === 'coat' && <path d="m55 37-9 12 8 8-6 263m8-283 9 12-8 8 6 263m-8-273v273" fill="none" stroke="#f4e8d5" strokeOpacity=".34" strokeWidth="1.4" />}
        {kind === 'dress' && <path d="m42 31 14 5 14-5 18 12-10 17-8-5 17 302c-20 13-42 13-62 0l17-302-8 5-10-17 18-12Z" fill={`url(#${gradientId})`} stroke={colour} strokeOpacity=".4" strokeWidth="1.2" strokeLinejoin="round" />}
        {kind === 'bottom' && <path d="M34 35h44l-3 150-3 185H53l-4-151-4 151H30l3-185-3-150h4Z" fill={`url(#${gradientId})`} stroke={colour} strokeOpacity=".4" strokeWidth="1.2" strokeLinejoin="round" />}
        {kind === 'skirt' && <path d="M35 35h42l5 39 17 242c-27 17-71 17-98 0L18 74l5-39h12Z" fill={`url(#${gradientId})`} stroke={colour} strokeOpacity=".4" strokeWidth="1.2" strokeLinejoin="round" />}
      </g>
    </svg>
  )
}
