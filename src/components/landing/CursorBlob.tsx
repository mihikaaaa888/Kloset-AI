import { useEffect, useRef, type RefObject } from 'react'

const SIZE = 440 // px
const REST = { x: 0.66, y: 0.42 } // resting spot, as a fraction of the section

// Pastel orbs: position/size as % of the blob, and three waypoints they swirl through.
const ORBS = [
  { color: '#cdb9f0', left: 14, top: 18, size: 58, dur: 9, path: ['30px, -24px', '-22px, 30px', '18px, 26px'] },
  { color: '#f7bfa8', left: 36, top: 30, size: 54, dur: 11, path: ['-34px, 18px', '26px, 22px', '-12px, -30px'] },
  { color: '#b5e2c6', left: 24, top: 40, size: 50, dur: 13, path: ['24px, 30px', '-30px, -14px', '30px, -22px'] },
  { color: '#f6c6d8', left: 40, top: 12, size: 42, dur: 8, path: ['-26px, 26px', '20px, -18px', '-30px, -10px'] },
]

/**
 * A blurred pastel blob that trails the cursor across `areaRef` with a springy
 * lag, stretching along its direction of travel, its outline always shifting. It rests behind the rail when
 * the cursor leaves. Only transforms change, so the blur is painted once.
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
    const place = (sx = 1, sy = 1, angle = 0) => {
      el.style.transform = `translate3d(${(pos.x - SIZE / 2).toFixed(1)}px, ${(pos.y - SIZE / 2).toFixed(1)}px, 0) rotate(${angle}rad) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
    }

    const tick = () => {
      frame = 0
      const dx = target.x - pos.x
      const dy = target.y - pos.y
      const ease = inside ? 0.09 : 0.04
      pos.x += dx * ease
      pos.y += dy * ease
      // Stretch along the direction of travel, more when moving fast.
      const speed = Math.hypot(dx, dy) * ease
      const s = Math.min(speed / 40, 0.28)
      place(1 + s, 1 - s * 0.6, Math.atan2(dy, dx))
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
      className="pointer-events-none absolute left-0 top-0 mix-blend-multiply will-change-transform"
      style={{ width: SIZE, height: SIZE }}
    >
      {/* Four soft orbs swirling on their own paths; blurred together they read
          as one gooey blob whose outline keeps changing. Each orb's blur is
          painted once; only its transform animates. */}
      {ORBS.map((orb, i) => (
        <span
          key={i}
          className="blob-orbit absolute rounded-full"
          style={{
            left: `${orb.left}%`,
            top: `${orb.top}%`,
            width: `${orb.size}%`,
            height: `${orb.size}%`,
            background: orb.color,
            filter: 'blur(26px)',
            animationDuration: `${orb.dur}s`,
            animationDelay: `${-orb.dur * i * 0.27}s`,
            ['--o1' as string]: orb.path[0],
            ['--o2' as string]: orb.path[1],
            ['--o3' as string]: orb.path[2],
          }}
        />
      ))}
    </div>
  )
}
