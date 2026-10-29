import { supabase } from './supabase'
import type { UserProfile } from '@/types'

type DbProfile = {
  id: string
  name: string
  age_range: string | null
  occupation: string | null
  lifestyle: string | null
  style_preferences: string[]
  typical_occasions: string[]
  favourite_colours: string[]
  avoid_colours: string[]
  gender_style_preference: string | null
  recommendation_frequency: string | null
  onboarding_complete: boolean
  style_item_selections?: string[] | null
  created_at: string
  updated_at: string
}

function toProfile(row: DbProfile): UserProfile {
  return {
    id: row.id,
    name: row.name,
    ageRange: (row.age_range ?? '') as UserProfile['ageRange'],
    occupation: row.occupation ?? '',
    lifestyle: row.lifestyle ?? '',
    stylePreferences: row.style_preferences as UserProfile['stylePreferences'],
    typicalOccasions: row.typical_occasions as UserProfile['typicalOccasions'],
    favouriteColours: row.favourite_colours,
    avoidColours: row.avoid_colours,
    genderStylePreference: (row.gender_style_preference ?? undefined) as UserProfile['genderStylePreference'],
    recommendationFrequency: (row.recommendation_frequency ?? 'weekly') as UserProfile['recommendationFrequency'],
    onboardingComplete: row.onboarding_complete,
    styleItemSelections: row.style_item_selections ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[profile] fetch failed', error.message)
    return null
  }
  if (!data) {
    console.log('[profile] no profile row yet', { userId })
    return null
  }
  const profile = toProfile(data as DbProfile)
  console.log('[profile] fetched', { onboardingComplete: profile.onboardingComplete, hasName: !!profile.name })
  return profile
}

// Returns true when the profile reached Supabase. Other devices only see what gets saved here.
export async function upsertProfile(userId: string, profile: UserProfile): Promise<boolean> {
  const row: Record<string, unknown> = {
    id: userId,
    name: profile.name,
    age_range: profile.ageRange || null,
    occupation: profile.occupation || null,
    lifestyle: profile.lifestyle || null,
    style_preferences: profile.stylePreferences,
    typical_occasions: profile.typicalOccasions,
    favourite_colours: profile.favouriteColours,
    avoid_colours: profile.avoidColours,
    gender_style_preference: profile.genderStylePreference ?? null,
    recommendation_frequency: profile.recommendationFrequency,
    onboarding_complete: profile.onboardingComplete,
    style_item_selections: profile.styleItemSelections ?? [],
    updated_at: new Date().toISOString(),
  }

  let { error } = await supabase.from('profiles').upsert(row)

  // Databases created before style_item_selections existed reject the whole row; save everything else.
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    console.warn('[profile] style_item_selections column missing, saving without it — run supabase/schema.sql')
    delete row.style_item_selections
    ;({ error } = await supabase.from('profiles').upsert(row))
  }

  if (error) {
    console.error('[profile] save failed', error.message)
    return false
  }
  console.log('[profile] saved', { onboardingComplete: profile.onboardingComplete })
  return true
}

// ─── Profile photo ────────────────────────────────────────────────────────────
// The file lives in the wardrobe-images bucket (private, one folder per user; see
// supabase/wardrobe_photos.sql). profiles.avatar_path (supabase/profile_photo.sql) names the current one.
// Kept apart from upsertProfile so a database without the column still saves everything else.

const AVATAR_BUCKET = 'wardrobe-images'

export async function fetchAvatarPath(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('avatar_path').eq('id', userId).maybeSingle()
  if (error) {
    console.warn('[profile] avatar path unavailable — run supabase/profile_photo.sql', error.message)
    return null
  }
  return (data as { avatar_path: string | null } | null)?.avatar_path ?? null
}

/** Uploads a new photo and points the profile at it. Returns the path, or null if it didn't reach Supabase. */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string | null> {
  // A fresh path per upload, so cached signed URLs for the old photo can never show the wrong picture.
  const path = `${userId}/avatar-${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (uploadError) {
    console.error('[profile] avatar upload failed — run supabase/wardrobe_photos.sql if the bucket is missing', uploadError.message)
    return null
  }
  if (!(await saveAvatarPath(userId, path))) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path])
    return null
  }
  return path
}

export async function saveAvatarPath(userId: string, path: string | null): Promise<boolean> {
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId)
  if (error) {
    console.error('[profile] saving avatar path failed — run supabase/profile_photo.sql', error.message)
    return false
  }
  return true
}

export async function removeAvatarFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path])
  if (error) console.warn('[profile] could not delete old avatar', error.message)
}
