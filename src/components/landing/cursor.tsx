import { useEffect, useRef, type RefObject } from 'react'

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
