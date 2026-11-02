import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { fetchProfile, upsertProfile } from '@/lib/profileService'
import { fetchWardrobe, backfillPhotos, updateItem } from '@/lib/wardrobeService'
import { isPendingDelete } from '@/store/undoStore'
import { SAMPLE_PHOTOS } from '@/lib/sampleData'
import type { ClothingItem } from '@/types'

const photoBackfillInFlight = new Set<string>()
const photoBackfillAttempted = new Set<string>()

// Loads the authenticated user's profile and wardrobe from Supabase into local stores.
// Runs once per login. Clears local stores on logout.
export function useDataSync() {
  const { user } = useAuth()
  const setProfile = useUserStore((s) => s.setProfile)
  const clearProfile = useUserStore((s) => s.clearProfile)
  const markLoaded = useUserStore((s) => s.markLoaded)
  const setItems = useWardrobeStore((s) => s.setItems)
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      if (prevUserIdRef.current) {
        clearProfile()
        setItems([])
        photoBackfillAttempted.delete(prevUserIdRef.current)
        prevUserIdRef.current = null
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

      if (items) setItems(items.filter((i) => !isPendingDelete(`wardrobe:${i.id}`)))
      markLoaded(userId)
      addSamplePhotos(userId)
      startPhotoBackfill(userId, items ?? useWardrobeStore.getState().items)
      console.log('[sync] profile ready', {
        onboardingComplete: !!useUserStore.getState().profile?.onboardingComplete,
      })
    }

    sync()
  }, [user, setProfile, clearProfile, markLoaded, setItems])

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
      startPhotoBackfill(userId, remote)
    }

    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [user, setItems])
}

function startPhotoBackfill(userId: string, wardrobe: ClothingItem[]) {
  if (photoBackfillInFlight.has(userId) || photoBackfillAttempted.has(userId)) return
  photoBackfillInFlight.add(userId)
  photoBackfillAttempted.add(userId)

  void (async () => {
    try {
      await backfillPhotos(userId, wardrobe)
    } catch (error) {
      console.error('[sync] photo backfill failed', error)
    } finally {
      photoBackfillInFlight.delete(userId)
    }
  })()
}

const REFRESH_GAP_MS = 10_000

/**
 * Server copy wins, but a piece added here in the last minute may still be uploading — keep it.
 * Pieces waiting on an Undo toast are still in the database, so leave them out.
 */
function mergeWithUnsaved(remote: ClothingItem[], local: ClothingItem[]): ClothingItem[] {
  const remoteIds = new Set(remote.map((i) => i.id))
  const cutoff = Date.now() - 60_000
  const unsaved = local.filter((i) => !remoteIds.has(i.id) && Date.parse(i.createdAt) > cutoff)
  return [...remote, ...unsaved].filter((i) => !isPendingDelete(`wardrobe:${i.id}`))
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
