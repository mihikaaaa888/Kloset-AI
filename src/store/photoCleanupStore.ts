import { create } from 'zustand'

interface PhotoCleanupState {
  active: boolean
  done: number
  total: number
  failed: number
  start: (total: number) => void
  update: (done: number, total: number, failed: number) => void
  finish: () => void
  clear: () => void
}

export const usePhotoCleanupStore = create<PhotoCleanupState>((set) => ({
  active: false,
  done: 0,
  total: 0,
  failed: 0,
  start: (total) => set({ active: true, done: 0, total, failed: 0 }),
  update: (done, total, failed) => set({ done, total, failed }),
  finish: () => set({ active: false }),
  clear: () => set({ active: false, done: 0, total: 0, failed: 0 }),
}))
