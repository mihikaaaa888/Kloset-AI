import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { clsx } from 'clsx'

/** Secondary colours used only for stamps, badges and swatches. */
export const INKS = {
  blush: '#f2a991',
  mustard: '#e9c46a',
  sage: '#a9d1b2',
  cream: '#fffdf3',
  forest: '#355e3b',
} as const

// A scalloped circle (18 bumps) for seal stamps, in a 120x120 box.
const SCALLOP = (() => {
  const pts: string[] = []
  for (let i = 0; i <= 360; i += 3) {
    const t = (i * Math.PI) / 180
    const r = 55 + 3.6 * Math.cos(18 * t)
    pts.push(`${(60 + r * Math.cos(t)).toFixed(2)},${(60 + r * Math.sin(t)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})()

/** A scalloped seal with a turning ring of text, like a sticker slapped on a menu. */
export function Stamp({
  ring,
  children,
  fill = INKS.blush,
  ink = INKS.forest,
  size = 112,
  className,
  style,
}: {
  ring: string
  children: ReactNode
  fill?: string
  ink?: string
  size?: number
  className?: string
  style?: CSSProperties
}) {
  const id = useId().replace(/:/g, '')
  return (
    <span aria-hidden="true" className={clsx('pointer-events-none block select-none drop-shadow-[0_8px_14px_rgba(36,27,41,0.22)]', className)} style={{ width: size, height: size, ...style }}>
      <span className="relative block h-full w-full">
      <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible">
        <path d={SCALLOP} fill={fill} />
        <circle cx="60" cy="60" r="46" fill="none" stroke={ink} strokeWidth="0.8" strokeDasharray="2 2.4" />
        <defs>
          <path id={`ring-${id}`} d="M60,60 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <g className="stamp-spin" style={{ transformOrigin: '60px 60px' }}>
          <text fill={ink} fontSize="8.6" fontFamily="Montserrat, sans-serif" fontWeight="700" letterSpacing="2.2">
            <textPath href={`#ring-${id}`}>{ring}</textPath>
          </text>
        </g>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-center font-display text-[15px] font-semibold italic leading-[1.05]" style={{ color: ink }}>
        {children}
      </span>
      </span>
    </span>
  )
}

/** A tilted, hand-inked oval tag that overlaps headlines. */
export function OvalTag({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={clsx('inline-flex items-center rounded-[50%] border-[1.5px] border-current bg-warm-cream px-6 py-2 font-display text-xl font-semibold normal-case italic leading-none tracking-normal shadow-[2px_3px_0_rgb(var(--c-butter-yellow)/0.25)]', className)}
      style={style}
    >
      {children}
    </span>
  )
}

/** Small spaced capitals set on an arch, above a title. */
export function ArcText({ children, className }: { children: string; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 200 40" aria-hidden="true" className={clsx('mx-auto block h-10 w-64 overflow-visible', className)}>
      <path id={`arc-${id}`} d="M20,36 Q100,4 180,36" fill="none" />
      <text fill="currentColor" fontSize="15" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight="600" letterSpacing="4" textAnchor="middle">
        <textPath href={`#arc-${id}`} startOffset="50%">{children}</textPath>
      </text>
    </svg>
  )
}

/** A checkerboard band, like a tablecloth edge. */
export function Checker({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={clsx('h-4 w-full', className)}
      style={{
        background: `repeating-conic-gradient(${light ? INKS.cream : 'rgb(var(--c-butter-yellow))'} 0 25%, ${light ? 'rgb(var(--c-butter-yellow))' : INKS.cream} 0 50%) 0 0 / 16px 16px`,
      }}
    />
  )
}

/** A rotated diamond badge with a double rule. */
export function Diamond({ children, className, fill = INKS.mustard, style }: { children: ReactNode; className?: string; fill?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={clsx('pointer-events-none flex h-20 w-20 items-center justify-center', className)} style={style}>
      <span className="absolute h-14 w-14 rotate-45 shadow-[0_8px_14px_rgba(36,27,41,0.2),inset_0_0_0_3px_var(--fill),inset_0_0_0_4px_rgba(53,94,59,0.7)]" style={{ background: fill, ['--fill' as string]: fill }} />
      <span className="relative text-center font-display text-[13px] font-bold italic uppercase leading-[1] text-butter-yellow">{children}</span>
    </span>
  )
}

/** Duten-style giant tone-on-tone word, drifting sideways as the section scrolls. */
export function GiantWord({ children, className }: { children: string; className?: string }) {
  return (
    <div aria-hidden="true" className={clsx('giant-word drift-x pointer-events-none select-none whitespace-nowrap font-sans font-extrabold lowercase leading-[0.78] tracking-[-0.06em]', className)}>
      {children}
    </div>
  )
}

/**
 * A hand-written "drag me" note with an inked arrow. The arrow draws itself as
 * it scrolls into view and the note bobs gently; pass `hidden` once the visitor
 * has used the thing it points at. `rotate`/`flip` aim the arrow (it points
 * down-left by default); `arrowFirst` puts the arrow before the words.
 */
export function Hint({
  text,
  className,
  rotate = 0,
  flip = false,
  arrowFirst = false,
  hidden = false,
  tone = 'ink',
}: {
  text: string
  className?: string
  rotate?: number
  flip?: boolean
  arrowFirst?: boolean
  hidden?: boolean
  tone?: 'ink' | 'cream'
}) {
  // Ink the arrow the first time the note comes into view.
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.setAttribute('data-shown', ''); io.disconnect() }
    }, { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const arrow = (
    <svg viewBox="0 0 70 50" className="h-10 w-14 shrink-0 overflow-visible" style={{ transform: `rotate(${rotate}deg) scaleX(${flip ? -1 : 1})` }}>
      <path className="hint-draw" pathLength={1} d="M64 6 C 50 3, 20 8, 12 38" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path className="hint-draw hint-draw-late" pathLength={1} d="M5 29 L12 39 L22 31" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={clsx(
        'hint-bob pointer-events-none z-30 flex select-none items-end gap-1 font-hand text-[1.7rem] leading-none transition-opacity duration-500',
        tone === 'cream' ? 'text-[#f6eec4]' : 'text-text-primary/75',
        hidden && 'opacity-0',
        className
      )}
    >
      {arrowFirst && arrow}
      <span className="-rotate-6 whitespace-nowrap">{text}</span>
      {!arrowFirst && arrow}
    </span>
  )
}
