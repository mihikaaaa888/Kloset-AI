import { create } from 'zustand'

/** How long the Undo button stays up before a deletion becomes final. */
export const UNDO_WINDOW_MS = 6000

interface UndoEntry {
  id: string
  message: string
  /** Puts the thing back. Missing for plain notices, which show no Undo button. */
  undo?: () => void
  /** The part that can't be taken back (database rows, stored photos). Runs when the window closes. */
  commit?: () => void | Promise<void>
  /** Keys other code checks with `isPendingDelete`, so a background refresh doesn't bring the item back early. */
  keys: string[]
  /** Lets a screen finish its own pending deletions when it closes, e.g. the Add item form. */
  scope?: string
}

interface UndoStore {
  current: UndoEntry | null
}

export const useUndoStore = create<UndoStore>()(() => ({ current: null }))

const pendingKeys = new Set<string>()
let timer: ReturnType<typeof setTimeout> | undefined

export const isPendingDelete = (key: string) => pendingKeys.has(key)

function clear(entry: UndoEntry) {
  clearTimeout(timer)
  entry.keys.forEach((k) => pendingKeys.delete(k))
  if (useUndoStore.getState().current?.id === entry.id) useUndoStore.setState({ current: null })
}

function finalize(entry: UndoEntry) {
  clear(entry)
  if (!entry.commit) return
  Promise.resolve()
    .then(entry.commit)
    .then(() => console.log('[undo] deletion committed', entry.message))
    .catch((err) => console.error('[undo] deletion failed to commit', entry.message, err))
}

function show(entry: UndoEntry) {
  const previous = useUndoStore.getState().current
  // Only one toast at a time: a new deletion makes the previous one final.
  if (previous) finalize(previous)
  entry.keys.forEach((k) => pendingKeys.add(k))
  useUndoStore.setState({ current: entry })
  timer = setTimeout(() => finalize(entry), UNDO_WINDOW_MS)
}

/**
 * Removes something straight away and shows an Undo toast. `remove` should only change
 * local state; anything permanent goes in `commit`, which runs once the toast closes.
 */
export function deleteWithUndo(opts: {
  message: string
  remove: () => void
  restore: () => void
  commit?: () => void | Promise<void>
  keys?: string[]
  scope?: string
}) {
  opts.remove()
  console.log('[undo] deleted, undo offered', opts.message)
  show({
    id: crypto.randomUUID(),
    message: opts.message,
    undo: opts.restore,
    commit: opts.commit,
    keys: opts.keys ?? [],
    scope: opts.scope,
  })
}

/** A short notice in the same spot, without an Undo button (used when a deletion fails). */
export function notify(message: string) {
  show({ id: crypto.randomUUID(), message, keys: [] })
}

export function undoLast() {
  const entry = useUndoStore.getState().current
  if (!entry?.undo) return
  clear(entry)
  entry.undo()
  console.log('[undo] restored', entry.message)
}

export function dismissUndo() {
  const entry = useUndoStore.getState().current
  if (entry) finalize(entry)
}

/** Makes any deletion from this screen final now, e.g. because the screen is closing. */
export function finalizeScope(scope: string) {
  const entry = useUndoStore.getState().current
  if (entry?.scope === scope) finalize(entry)
}

// Closing the tab inside the window: try to finish the deletion rather than lose it.
// If the request doesn't make it out, the item simply reappears next visit.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', dismissUndo)
}
