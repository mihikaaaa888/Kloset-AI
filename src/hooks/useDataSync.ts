import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { fetchProfile, upsertProfile } from '@/lib/profileService'
import { fetchWardrobe, backfillPhotos, removeBackgroundsFromExistingPhotos, updateItem } from '@/lib/wardrobeService'
import { usePhotoCleanupStore } from '@/store/photoCleanupStore'
import { SAMPLE_PHOTOS } from '@/lib/sampleData'
import type { ClothingItem } from '@/types'

const photoCleanupInFlight = new Set<string>()
const photoCleanupAttempted = new Set<string>()

// Loads the authenticated user's profile and wardrobe from Supabase into local stores.
// Runs once per login. Clears local stores on logout.
export function useDataSync() {
  const { user } = useAuth()
  const setProfile = useUserStore((s) => s.setProfile)
  const clearProfile = useUserStore((s) => s.clearProfile)
  const markLoaded = useUserStore((s) => s.markLoaded)
  const setItems = useWardrobeStore((s) => s.setItems)
  const clearPhotoCleanup = usePhotoCleanupStore((s) => s.clear)
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      if (prevUserIdRef.current) {
        clearProfile()
        setItems([])
        photoCleanupAttempted.delete(prevUserIdRef.current)
        prevUserIdRef.current = null
        clearPhotoCleanup()
      }
      return
    }

    if (user.id === prevUserIdRef.current) return
    prevUserIdRef.current = user.id

    // A profile cached in this browser from a different account must never show for this one.
    const cached = useUserStore.getState().profile
    if (cached && cached.id !== user.id) {
      console.log('[sync] clearing cached profile from another account')
      clearProfile()
    }

    async function sync() {
      const userId = user!.id
      const [remote, items] = await Promise.all([fetchProfile(userId), fetchWardrobe(userId)])
      const local = useUserStore.getState().profile

      if (remote?.onboardingComplete) {
        setProfile(remote)
      } else if (local?.id === userId && local.onboardingComplete) {
        // Onboarding finished here but never reached the server (older builds dropped failed saves).
        // Keep the local answers and push them up so other devices get them too.
        console.log('[sync] local profile is complete but server copy is not, re-uploading')
        await upsertProfile(userId, local)
      } else if (remote) {
        setProfile(remote)
      }

      if (items) setItems(items)
      markLoaded(userId)
      addSamplePhotos(userId)
      startExistingPhotoCleanup(userId, items ?? useWardrobeStore.getState().items)
      console.log('[sync] profile ready', {
        onboardingComplete: !!useUserStore.getState().profile?.onboardingComplete,
      })
    }

    sync()
  }, [user, setProfile, clearProfile, markLoaded, setItems, clearPhotoCleanup])

  // Pieces added on another device (say, photos from the phone) only arrive on a
  // fetch, so re-pull the wardrobe whenever this tab comes back into view.
  useEffect(() => {
    if (!user) return
    const userId = user.id
    let lastRefresh = Date.now()

    const refresh = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < REFRESH_GAP_MS) return
      lastRefresh = Date.now()
      const remote = await fetchWardrobe(userId)
      if (!remote || prevUserIdRef.current !== userId) return
      setItems(mergeWithUnsaved(remote, useWardrobeStore.getState().items))
      console.log('[sync] wardrobe refreshed', { items: remote.length })
      startExistingPhotoCleanup(userId, remote)
    }

    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [user, setItems])
}

function startExistingPhotoCleanup(userId: string, wardrobe: ClothingItem[]) {
  if (photoCleanupInFlight.has(userId) || photoCleanupAttempted.has(userId)) return
  photoCleanupInFlight.add(userId)
  photoCleanupAttempted.add(userId)

  void (async () => {
    try {
      await backfillPhotos(userId, wardrobe)
      const latest = await fetchWardrobe(userId)
      const items = latest ?? wardrobe
      const candidates = items.filter((item) =>
        item.imageSource === 'local' &&
        !!item.imageId &&
        !(item.imageStoragePath?.toLowerCase().endsWith('.png') ||
          (!item.imageStoragePath && item.imageUrl?.startsWith('data:image/png')))
      )
      if (candidates.length === 0) return

      const cleanup = usePhotoCleanupStore.getState()
      cleanup.start(candidates.length)
      await removeBackgroundsFromExistingPhotos(userId, candidates, (done, total, failed) => {
        usePhotoCleanupStore.getState().update(done, total, failed)
      })
      usePhotoCleanupStore.getState().finish()
      window.setTimeout(() => usePhotoCleanupStore.getState().clear(), 12_000)
    } catch (error) {
      console.error('[sync] existing photo background cleanup failed', error)
      usePhotoCleanupStore.getState().finish()
    } finally {
      photoCleanupInFlight.delete(userId)
    }
  })()
}

const REFRESH_GAP_MS = 10_000

/** Server copy wins, but a piece added here in the last minute may still be uploading — keep it. */
function mergeWithUnsaved(remote: ClothingItem[], local: ClothingItem[]): ClothingItem[] {
  const remoteIds = new Set(remote.map((i) => i.id))
  const cutoff = Date.now() - 60_000
  const unsaved = local.filter((i) => !remoteIds.has(i.id) && Date.parse(i.createdAt) > cutoff)
  return [...remote, ...unsaved]
}

// Demo pieces from "Load sample wardrobe" used to be saved without photos.
// Give any that still have none their stock photo, locally and on the server.
function addSamplePhotos(userId: string) {
  const { items, updateItem: updateLocal } = useWardrobeStore.getState()
  const missing = items.filter(
    (i) => SAMPLE_PHOTOS[i.name] && !i.imageUrl && !i.imageId && !i.imageStoragePath
  )
  if (!missing.length) return
  console.log('[sync] adding stock photos to', missing.length, 'sample pieces')
  for (const item of missing) {
    const updated: ClothingItem = { ...item, imageUrl: SAMPLE_PHOTOS[item.name], imageSource: 'remote' }
    updateLocal(item.id, updated)
    updateItem(userId, updated).catch((e) => console.error('[sync] sample photo save failed', item.name, e))
  }
}
