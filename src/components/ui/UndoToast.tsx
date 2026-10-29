import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, X } from 'lucide-react'
import { UNDO_WINDOW_MS, dismissUndo, undoLast, useUndoStore } from '@/store/undoStore'

/** The single "Removed · Undo" toast shown after any deletion. Mounted once in App. */
export function UndoToast() {
  const entry = useUndoStore((s) => s.current)

  // Cmd/Ctrl+Z undoes too, unless the person is typing in a field.
  useEffect(() => {
    if (!entry?.undo) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      undoLast()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entry])

  if (!entry) return null

  return createPortal(
    <div
      className="fixed inset-x-0 z-[80] flex justify-center px-4 pointer-events-none bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-8"
    >
      <div
        key={entry.id}
        role="status"
        aria-live="polite"
        className="pointer-events-auto relative overflow-hidden flex items-center gap-1 pl-5 pr-1.5 py-1.5 max-w-md w-full sm:w-auto rounded-full bg-dark-purple text-butter-yellow shadow-lifted ring-1 ring-butter-yellow/15 animate-fade-up"
      >
        <p className="flex-1 min-w-0 text-sm truncate pr-2">{entry.message}</p>
        {entry.undo && (
          <button
            onClick={undoLast}
            className="h-9 px-4 flex items-center gap-1.5 rounded-full bg-butter-yellow text-dark-purple text-2xs font-semibold uppercase tracking-widest hover:bg-soft-butter transition-colors"
          >
            <RotateCcw size={13} strokeWidth={2} />
            Undo
          </button>
        )}
        <button
          onClick={dismissUndo}
          aria-label="Dismiss"
          className="w-9 h-9 flex items-center justify-center rounded-full text-butter-yellow/60 hover:text-butter-yellow hover:bg-butter-yellow/10 transition-colors"
        >
          <X size={15} />
        </button>
        <span
          aria-hidden
          className="absolute left-0 bottom-0 h-0.5 w-full bg-butter-yellow/50 origin-left"
          style={{ animation: `undo-countdown ${UNDO_WINDOW_MS}ms linear forwards` }}
        />
      </div>
    </div>,
    document.body
  )
}
