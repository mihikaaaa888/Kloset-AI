import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  variant?: 'dialog' | 'sheet'
  maxWidth?: string
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'dialog',
  maxWidth = 'max-w-lg',
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const content =
    variant === 'sheet' ? (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div
          className="absolute inset-0 bg-scrim/40 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        />
        <div className="relative bg-surface rounded-t-3xl shadow-lifted animate-slide-up max-h-[92dvh] flex flex-col">
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-text-primary/15" />
          </div>
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-text-primary/10 flex-shrink-0">
              <h2 className="font-serif text-xl font-medium text-text-primary">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-11 h-11 -mr-2.5 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-text-primary/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="overflow-y-auto flex-1">{children}</div>
          {footer && (
            <div
              className="flex-shrink-0 border-t border-text-primary/10 px-6 pt-4 pb-4"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <div
          className="absolute inset-0 bg-scrim/40 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        />
        <div
          className={clsx(
            'relative bg-surface rounded-t-3xl sm:rounded-3xl shadow-lifted animate-slide-up sm:animate-fade-up w-full flex flex-col',
            maxWidth,
            'max-h-[92dvh] sm:max-h-[90vh]'
          )}
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-5 border-b border-text-primary/10 flex-shrink-0">
              <h2 className="font-serif text-xl font-medium text-text-primary">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-11 h-11 -mr-2.5 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-text-primary/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="overflow-y-auto flex-1">{children}</div>
          {footer && (
            <div
              className="flex-shrink-0 border-t border-text-primary/10 px-6 pt-4 pb-4"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    )

  return createPortal(content, document.body)
}
