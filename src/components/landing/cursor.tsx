import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { clsx } from 'clsx'

type Listener = (x: number, y: number) => void

// One window listener for the whole page, batched to animation frames. Subscribers
// write straight to the DOM (CSS variables / transforms), so React never re-renders.
const listeners = new Set<Listener>()
let px = -1
let py = -1
let frame = 0

function onMove(e: PointerEvent) {
  px = e.clientX
  py = e.clientY
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    listeners.forEach((fn) => fn(px, py))
  })
}

export function usePointer(fn: Listener) {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    const sub: Listener = (x, y) => latest.current(x, y)
    if (listeners.size === 0) window.addEventListener('pointermove', onMove, { passive: true })
    listeners.add(sub)
    return () => {
      listeners.delete(sub)
      if (listeners.size === 0) window.removeEventListener('pointermove', onMove)
    }
  }, [])
}

/** Writes the pointer position relative to an element as --px / --py (-0.5..0.5) and --cx / --cy (px). */
export function usePointerVars(ref: RefObject<HTMLElement>) {
  usePointer((x, y) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > window.innerHeight) return
    el.style.setProperty('--px', ((x - r.left) / r.width - 0.5).toFixed(3))
    el.style.setProperty('--py', ((y - r.top) / r.height - 0.5).toFixed(3))
    el.style.setProperty('--cx', `${Math.round(x - r.left)}px`)
    el.style.setProperty('--cy', `${Math.round(y - r.top)}px`)
  })
}

/** A pair of eyes that watch the cursor, and blink now and then. */
export function Eyes({ size = 26, className, lid = 'rgb(var(--c-text-primary))' }: { size?: number; className?: string; lid?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  usePointer((x, y) => {
    const root = ref.current
    if (!root) return
    root.querySelectorAll<HTMLElement>('[data-pupil]').forEach((pupil) => {
      const eye = pupil.parentElement
      if (!eye) return
      const r = eye.getBoundingClientRect()
      if (r.bottom < 0 || r.top > window.innerHeight) return
      const dx = x - (r.left + r.width / 2)
      const dy = y - (r.top + r.height / 2)
      const angle = Math.atan2(dy, dx)
      const reach = Math.min(r.width * 0.24, Math.hypot(dx, dy) / 10)
      pupil.style.transform = `translate(${(Math.cos(angle) * reach).toFixed(1)}px, ${(Math.sin(angle) * reach).toFixed(1)}px)`
    })
  })

  return (
    <span ref={ref} aria-hidden="true" className={clsx('inline-flex', className)} style={{ gap: size * 0.18 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          className="relative block overflow-hidden rounded-full border-2 border-text-primary bg-white"
          style={{ width: size, height: size * 1.08 }}
        >
          <span data-pupil className="absolute left-[27%] top-[27%] h-[46%] w-[46%] rounded-full bg-text-primary transition-transform duration-150 ease-out">
            <span className="absolute right-[18%] top-[18%] h-[28%] w-[28%] rounded-full bg-white" />
          </span>
          <span className="eye-lid absolute inset-0 origin-top" style={{ background: lid, ['--d' as string]: `${i * 40}ms` } as CSSProperties} />
        </span>
      ))}
    </span>
  )
}

/** Kloset's little lint creature: a soft blob with watching eyes. */
export function Peeker({ className, style, color = 'rgb(var(--c-butter-yellow))' }: { className?: string; style?: CSSProperties; color?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx('flex items-start justify-center rounded-t-[999px] pt-4', className)}
      style={{ background: color, ...style }}
    >
      <Eyes size={22} lid={color} />
    </span>
  )
}
