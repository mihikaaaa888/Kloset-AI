import { useEffect, useRef, type RefObject } from 'react'

const SIZE = 560 // px
const REST = { x: 0.66, y: 0.42 } // resting spot, as a fraction of the section

/**
 * A faint sage wash that drifts after the cursor across `areaRef` with a slow,
 * even lag and settles behind the rail when the cursor leaves. No stretch and
 * no shape-shifting: it should read as light on the page, not as an object.
 * Only its transform changes, so the gradient is painted once.
 */
export function CursorBlob({ areaRef }: { areaRef: RefObject<HTMLElement> }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const area = areaRef.current
    if (!el || !area) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const pos = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    let frame = 0
    let inside = false

    const rest = () => {
      target.x = area.clientWidth * REST.x
      target.y = area.clientHeight * REST.y
    }
    const place = () => {
      el.style.transform = `translate3d(${(pos.x - SIZE / 2).toFixed(1)}px, ${(pos.y - SIZE / 2).toFixed(1)}px, 0)`
    }

    const tick = () => {
      frame = 0
      const dx = target.x - pos.x
      const dy = target.y - pos.y
      const ease = inside ? 0.045 : 0.025
      pos.x += dx * ease
      pos.y += dy * ease
      place()
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) frame = requestAnimationFrame(tick)
    }
    const kick = () => { if (!frame) frame = requestAnimationFrame(tick) }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = area.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      const nowInside = x >= 0 && y >= 0 && x <= r.width && y <= r.height
      if (nowInside) {
        target.x = x
        target.y = y
      } else if (inside) {
        rest()
      } else {
        return
      }
      inside = nowInside
      kick()
    }

    rest()
    pos.x = target.x
    pos.y = target.y
    place()
    if (reduce) return
    const ro = new ResizeObserver(() => { if (!inside) { rest(); kick() } })
    ro.observe(area)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [areaRef])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 will-change-transform"
      style={{
        width: SIZE,
        height: SIZE,
        background: 'radial-gradient(closest-side, rgb(102 168 122 / 0.34), rgb(102 168 122 / 0.13) 55%, transparent)',
      }}
    />
  )
}
