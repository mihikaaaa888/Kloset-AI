import { useEffect, useState } from 'react'
import { compressImage, deleteImage, getImage, saveImage, validateImageFile } from '@/lib/imageStorage'
import { fetchAvatarPath, removeAvatarFile, saveAvatarPath, uploadAvatar } from '@/lib/profileService'
import { getPhotoUrl } from '@/lib/wardrobeService'

/**
 * The profile photo. Supabase Storage is the source of truth (so every device shows it); a copy is
 * kept in this browser's IndexedDB so it appears instantly and still works if Supabase is unreachable.
 * localStorage remembers { imageId: local blob, path: the Storage file that blob mirrors }.
 */
type Saved = { imageId?: string; path?: string }

const key = (profileId: string) => `kloset-avatar-${profileId}`

function readSaved(profileId: string): Saved {
  try {
    const raw = localStorage.getItem(key(profileId))
    if (!raw) return {}
    // Earlier builds stored just the IndexedDB id as a plain string.
    return raw.startsWith('{') ? JSON.parse(raw) as Saved : { imageId: raw }
  } catch { return {} }
}

function writeSaved(profileId: string, saved: Saved) {
  try {
    if (saved.imageId || saved.path) localStorage.setItem(key(profileId), JSON.stringify(saved))
    else localStorage.removeItem(key(profileId))
  } catch { /* the photo still shows this session */ }
}

export function useAvatar(profileId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!profileId) { setUrl(null); return }
    let objectUrl: string | null = null
    let cancelled = false
    const show = (next: string) => {
      if (cancelled) return
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrl = next.startsWith('blob:') ? next : null
      setUrl(next)
    }

    ;(async () => {
      const saved = readSaved(profileId)
      const local = saved.imageId ? await getImage(saved.imageId).catch(() => null) : null
      if (local) show(URL.createObjectURL(local))

      const remotePath = await fetchAvatarPath(profileId)
      if (cancelled) return
      if (remotePath && remotePath !== saved.path) {
        // Set on another device, or replaced there: the server copy wins.
        const signed = await getPhotoUrl(remotePath)
        if (signed) show(signed)
        writeSaved(profileId, { path: remotePath })
        if (saved.imageId) void deleteImage(saved.imageId)
      } else if (!remotePath && local) {
        // Uploaded before photos synced: push this device's copy up once.
        const path = await uploadAvatar(profileId, local)
        if (path) writeSaved(profileId, { imageId: saved.imageId, path })
      }
    })().catch(() => {})

    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [profileId])

  const upload = async (file: File) => {
    if (!profileId) return
    const problem = validateImageFile(file)
    if (problem) { setError(problem); return }
    setBusy(true); setError(null)
    try {
      const blob = await compressImage(file)
      const previous = readSaved(profileId)
      const imageId = await saveImage(blob)
      setUrl((old) => { if (old?.startsWith('blob:')) URL.revokeObjectURL(old); return URL.createObjectURL(blob) })

      const path = await uploadAvatar(profileId, blob)
      writeSaved(profileId, { imageId, path: path ?? undefined })
      if (!path) setError('Saved on this device only — it couldn’t reach your account, so other devices won’t see it yet.')
      if (previous.imageId) void deleteImage(previous.imageId)
      if (path && previous.path) void removeAvatarFile(previous.path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that photo.')
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!profileId) return
    const saved = readSaved(profileId)
    if (saved.imageId) void deleteImage(saved.imageId)
    if (saved.path) { void saveAvatarPath(profileId, null); void removeAvatarFile(saved.path) }
    writeSaved(profileId, {})
    setUrl((old) => { if (old?.startsWith('blob:')) URL.revokeObjectURL(old); return null })
    setError(null)
  }

  return { url, error, busy, upload, remove }
}
