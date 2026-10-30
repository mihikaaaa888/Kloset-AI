import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Shown above the buttons when the action failed; the dialog stays open so it can be retried. */
  error?: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** The site's replacement for window.confirm, for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Remove',
  cancelLabel = 'Keep it',
  error,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} maxWidth="max-w-sm" layer="z-[70]">
      <div className="px-7 pt-9 pb-7 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-600/10 text-red-700 dark:text-red-400">
          <Trash2 size={22} strokeWidth={1.6} />
        </span>
        <h2 className="font-serif text-2xl font-medium text-text-primary leading-tight">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{message}</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p>}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
          <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">{cancelLabel}</Button>
          <Button
            onClick={onConfirm}
            loading={busy}
            className="flex-1 bg-red-700 text-white hover:bg-red-800 active:bg-red-700"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
