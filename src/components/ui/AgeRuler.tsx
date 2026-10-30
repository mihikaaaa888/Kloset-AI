import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clsx } from 'clsx'

const YEAR_PX = 56
const MINOR_TICKS = [0.1, 0.3, 0.7, 0.9]

/**
 * A horizontal ruler for picking a whole number (used for age). Swipe, drag, scroll
 * or use the arrow keys; the value under the centre marker is the selection.
 */
export function AgeRuler({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, n)), [min, max])

  const scrollToValue = useCallback((v: number, smooth = true) => {
    scrollerRef.current?.scrollTo({ left: (clamp(v) - min) * YEAR_PX, behavior: smooth ? 'smooth' : 'auto' })
  }, [clamp, min])

  // Start on the current value without animating.
  useLayoutEffect(() => {
    scrollToValue(value, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const next = clamp(min + Math.round(el.scrollLeft / YEAR_PX))
    if (next !== value) onChange(next)
  }

  // A mouse wheel scrolls vertically; turn that into moving along the ruler.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Touch scrolls natively; a mouse needs click-and-drag.
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !scrollerRef.current) return
    drag.current = { x: e.clientX, left: scrollerRef.current.scrollLeft }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current || !scrollerRef.current) return
    scrollerRef.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    scrollToValue(value)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]
    if (!step) return
    e.preventDefault()
    onChange(clamp(value + step))
    scrollToValue(value + step)
  }

  return (
    <div className="relative select-none">
      <div
        ref={scrollerRef}
        role="slider"
        tabIndex={0}
        aria-label="Age"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={clsx(
          'flex overflow-x-auto overscroll-x-contain rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-butter-yellow',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          '[mask-image:linear-gradient(to_right,transparent,black_22%,black_78%,transparent)]',
          dragging ? 'cursor-grabbing' : 'cursor-grab snap-x snap-mandatory'
        )}
      >
        <div aria-hidden className="flex-shrink-0" style={{ width: `calc(50% - ${YEAR_PX / 2}px)` }} />
        {years.map((year) => {
          const distance = Math.abs(year - value)
          return (
            <button
              key={year}
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => { onChange(year); scrollToValue(year) }}
              className="relative flex-shrink-0 h-24 snap-center"
              style={{ width: YEAR_PX }}
            >
              <span
                className={clsx(
                  'absolute top-1 left-1/2 -translate-x-1/2 text-sm tabular-nums transition-colors',
                  distance === 0 ? 'text-text-primary font-semibold' : 'text-text-primary'
                )}
                style={{ opacity: distance === 0 ? 1 : Math.max(0.25, 0.75 - distance * 0.12) }}
              >
                {year}
              </span>
              <span
                className={clsx(
                  'absolute bottom-6 left-1/2 -translate-x-1/2 w-0.5 h-8 rounded-full',
                  distance === 0 ? 'bg-butter-yellow' : 'bg-text-primary/45'
                )}
              />
              {MINOR_TICKS.map((at) => (
                <span
                  key={at}
                  className="absolute bottom-6 w-px h-4 rounded-full bg-text-primary/20"
                  style={{ left: `${at * 100}%` }}
                />
              ))}
            </button>
          )
        })}
        <div aria-hidden className="flex-shrink-0" style={{ width: `calc(50% - ${YEAR_PX / 2}px)` }} />
      </div>
      {/* Centre marker */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 bottom-1 -translate-x-1/2 w-0 h-0 border-x-[7px] border-x-transparent border-b-[9px] border-b-butter-yellow" />
    </div>
  )
}
