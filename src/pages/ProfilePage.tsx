import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Archive, Camera, ChevronRight, LogOut, Pencil, Shirt, Trash2, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'

import { ThemePicker } from '@/components/ui/ThemeToggle'
import { useItemImage } from '@/hooks/useItemImage'
import { useSampleKloset } from '@/hooks/useSampleKloset'
import { notify } from '@/store/undoStore'
import { deleteImage, getImage, saveImage } from '@/lib/imageStorage'
import { compressImage } from '@/lib/imageStorage'
import { useAuth } from '@/contexts/AuthContext'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useOutfitStore } from '@/store/outfitStore'
import { deleteAccount } from '@/lib/accountService'
import { supabase } from '@/lib/supabase'
import { CATALOG_STYLE_LABELS } from '@/lib/catalogData'
import { colourNameToHex } from '@/lib/colourUtils'
import { CategoryGlyph } from '@/components/wardrobe/categoryVisuals'
import type { ClothingItem } from '@/types'

function getInitials(name: string) {
  return name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2)
}

export function ProfilePage() {
  const navigate = useNavigate()
  const profile = useUserStore((state) => state.profile)
  const clearProfile = useUserStore((state) => state.clearProfile)
  const wardrobeItems = useWardrobeStore((state) => state.items)
  const savedOutfits = useOutfitStore((state) => state.savedOutfits)
  const clearOutfits = useOutfitStore((state) => state.clearOutfits)
  const { user, signOut } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  // The nav menu's "Settings" links here with ?settings=1.
  useEffect(() => {
    if (searchParams.get('settings') !== '1') return
    requestAnimationFrame(() => document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    setSearchParams((params) => { params.delete('settings'); return params }, { replace: true })
  }, [searchParams, setSearchParams])
  const [dangerOpen, setDangerOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [counts, setCounts] = useState({ pieces: 0, outfits: 0 })
  const avatarInput = useRef<HTMLInputElement>(null)

  const mostWornItems = wardrobeItems.filter((item) => item.timesWorn > 0).sort((a, b) => b.timesWorn - a.timesWorn).slice(0, 4)
  const neverWorn = wardrobeItems.filter((item) => item.timesWorn === 0).slice(0, 5)

  useEffect(() => {
    setCounts({ pieces: wardrobeItems.length, outfits: savedOutfits.length })
    const id = profile ? localStorage.getItem(`kloset-profile-avatar:${profile.id}`) : null
    setAvatarId(id)
  }, [profile?.id, wardrobeItems.length, savedOutfits.length])

  useEffect(() => {
    if (!avatarId) { setAvatarUrl(null); return }
    let active = true
    let objectUrl: string | null = null
    getImage(avatarId).then((blob) => {
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setAvatarUrl(objectUrl)
    }).catch((error) => console.error('[profile] avatar image failed to load', error))
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [avatarId])

  if (!profile) {
    return <div className="flex min-h-screen items-center justify-center bg-warm-cream px-6 pt-20"><div className="text-center"><h1 className="mb-3 font-display text-4xl text-text-primary">Your profile</h1><button onClick={() => navigate('/onboarding')} className="border-b border-text-primary/40 text-sm text-text-primary">Complete onboarding</button></div></div>
  }

  const handleEditProfile = () => navigate('/onboarding?edit=true')
  const handleAvatar = async (file?: File) => {
    if (!file || !profile) return
    try {
      const id = await saveImage(await compressImage(file))
      localStorage.setItem(`kloset-profile-avatar:${profile.id}`, id)
      setAvatarId(id)
    } catch (error) { console.error('[profile] avatar upload failed', error) }
  }
  const handleDeleteAccount = async () => {
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) throw new Error('Please sign in again before deleting your account.')
      await deleteAccount(session.access_token)
      await Promise.all(wardrobeItems.map((item) => item.imageId ? deleteImage(item.imageId).catch(() => {}) : Promise.resolve()))
      if (avatarId) await deleteImage(avatarId).catch(() => {})
      if (profile) localStorage.removeItem(`kloset-profile-avatar:${profile.id}`)
      useWardrobeStore.getState().setItems([])
      clearOutfits()
      clearProfile()
      await supabase.auth.signOut({ scope: 'local' })
      navigate('/', { replace: true })
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete your account. Please try again.')
      setDeleteBusy(false)
    }
  }
  const handleSignOut = async () => {
    try { await signOut(); navigate('/') } catch (error) { console.error('[profile] sign out failed', error) }
  }
  const favouriteCount = wardrobeItems.filter((item) => item.isFavourite).length
  const subtitle = [profile.occupation, profile.ageRange ? `Age ${profile.ageRange}` : null].filter(Boolean).join(' · ')
  const shopsFor = profile.genderStylePreference === 'feminine' ? "Women's" : profile.genderStylePreference === 'masculine' ? "Men's" : profile.genderStylePreference === 'androgynous' ? "Women's and men's" : null
  const styleRows: { label: string; content: React.ReactNode }[] = [
    ...(profile.stylePreferences.length ? [{ label: 'Style', content: <ChipList values={profile.stylePreferences.map((style) => CATALOG_STYLE_LABELS[style] ?? style)} /> }] : []),
    ...(profile.typicalOccasions.length ? [{ label: 'Dresses for', content: <ChipList values={profile.typicalOccasions.map((occasion) => occasion.replace(/-/g, ' '))} /> }] : []),
    ...(profile.favouriteColours.length ? [{ label: 'Colours you love', content: <ColourList colours={profile.favouriteColours} /> }] : []),
    ...(profile.avoidColours.length ? [{ label: 'Colours you avoid', content: <ColourList colours={profile.avoidColours} /> }] : []),
    ...(profile.favouriteBrands?.length ? [{ label: 'Favourite brands', content: <ChipList values={profile.favouriteBrands} /> }] : []),
    ...(shopsFor ? [{ label: 'Shops for', content: <p className="text-sm text-text-primary">{shopsFor}</p> }] : []),
    ...(profile.lifestyle ? [{ label: 'Lifestyle', content: <p className="max-w-[65ch] text-sm leading-relaxed text-text-primary">{profile.lifestyle}</p> }] : []),
  ]

  const hasPhoto = (item: ClothingItem) => !!(item.imageUrl || item.imageId || item.imageStoragePath)
  // Favourites lead the cover collage, then anything with a photo.
  const coverItems = [...wardrobeItems].filter(hasPhoto).sort((a, b) => Number(b.isFavourite) - Number(a.isFavourite)).slice(0, 3)

  return (
    <main className="min-h-screen bg-warm-cream pt-16 pb-28 text-text-primary lg:pt-20 md:pb-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-6 sm:px-6 lg:grid-cols-[19rem_1fr] lg:gap-14 lg:px-8 lg:pt-8">
        {/* Profile card: their own pieces as the cover, photo, name and counts. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CoverCollage items={coverItems} />
          <div className="relative -mt-10 flex items-end justify-between gap-3 px-4">
            <button type="button" onClick={() => avatarInput.current?.click()} aria-label="Change profile photo" className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-tile ring-4 ring-warm-cream">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-text-primary font-display text-2xl text-warm-cream">{getInitials(profile.name)}</span>}
              <span className="absolute inset-0 flex items-center justify-center bg-text-primary/45 text-warm-cream opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Camera size={18} /></span>
            </button>
            <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => { void handleAvatar(event.target.files?.[0]); event.target.value = '' }} />
            <button onClick={handleEditProfile} className="mb-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-text-primary/20 bg-warm-cream px-4 text-xs text-text-primary transition-colors hover:border-text-primary/45 hover:bg-text-primary/5">
              <Pencil size={13} /> Edit profile
            </button>
          </div>
          <div className="mt-3 px-1">
            <h1 className="break-words font-display text-3xl font-medium leading-tight">{profile.name}</h1>
            {(subtitle || user?.email) && <p className="mt-1 truncate text-sm text-text-muted">{subtitle || user?.email}</p>}
          </div>
          <div className="mt-5 grid grid-cols-3 border-y border-text-primary/10">
            <Stat value={counts.pieces} label={counts.pieces === 1 ? 'piece' : 'pieces'} onClick={() => navigate('/wardrobe')} />
            <Stat value={counts.outfits} label={counts.outfits === 1 ? 'outfit' : 'outfits'} onClick={() => navigate('/wardrobe?view=outfits')} />
            <Stat value={favouriteCount} label={favouriteCount === 1 ? 'favourite' : 'favourites'} onClick={() => navigate('/wardrobe')} />
          </div>
        </aside>

        <div className="min-w-0 space-y-12">
          {wardrobeItems.length > 0 && (
            <Section id="colour-heading" title="Your Kloset in colour">
              <ColourBreakdown items={wardrobeItems} />
            </Section>
          )}

          {wardrobeItems.length > 0 && (
            <Section id="category-heading" title="What’s inside">
              <CategoryBreakdown items={wardrobeItems} onOpen={() => navigate('/wardrobe')} />
            </Section>
          )}

          <Section id="style-heading" title="Your style" action={<button onClick={handleEditProfile} className="text-xs text-text-muted underline-offset-4 hover:text-text-primary hover:underline">Edit</button>}>
            {styleRows.length ? (
              <dl className="grid gap-x-8 gap-y-6 bg-surface p-5 ring-1 ring-inset ring-text-primary/10 sm:grid-cols-2 sm:p-6">
                {styleRows.map((row) => (
                  <div key={row.label} className={clsx('min-w-0', row.label === 'Lifestyle' && 'sm:col-span-2')}>
                    <dt className="mb-2 text-xs text-text-muted">{row.label}</dt>
                    <dd>{row.content}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-text-muted">Tell Kloset what you like to wear and your picks get better. <button onClick={handleEditProfile} className="text-text-primary underline underline-offset-4">Set up your style</button></p>
            )}
          </Section>

          <Section id="worn-heading" title="Most worn">
            {mostWornItems.length > 0
              ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">{mostWornItems.map((item, index) => <PieceTile key={item.id} item={item} badge={index === 0 ? 'Top pick' : undefined} note={`Worn ${item.timesWorn} ${item.timesWorn === 1 ? 'time' : 'times'}`} onOpen={() => navigate('/wardrobe')} />)}</div>
              : <p className="text-sm text-text-muted">Log when you wear a piece in your Kloset and your go-tos show up here.</p>}
          </Section>

          <Section id="never-heading" title="Waiting for a first outing">
            {neverWorn.length
              ? <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">{neverWorn.map((item) => <PieceTile key={item.id} item={item} className="w-32 shrink-0 sm:w-auto" onOpen={() => navigate('/wardrobe')} />)}</div>
              : wardrobeItems.length === 0
                ? <p className="text-sm text-text-muted">Your Kloset is empty for now. <button onClick={() => navigate('/wardrobe')} className="text-text-primary underline underline-offset-4">Add your first piece</button></p>
                : <p className="text-sm text-text-muted">Everything has had a turn. Nice.</p>}
          </Section>

          <Section id="settings" title="Settings">
            <div className="divide-y divide-text-primary/10 border-y border-text-primary/10">
              <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm">Appearance</p><ThemePicker /></div>
              <SettingsRow icon={Archive} title="Recycle bin" subtitle="Restore or permanently delete saved outfits" onClick={() => navigate('/wardrobe?view=outfits&recycle=1')} />
              <SampleKlosetRow />
              <SettingsRow icon={LogOut} title="Sign out" subtitle={user?.email ?? 'Sign out of your account'} onClick={() => void handleSignOut()} />
            </div>
            <div className="mt-8">
              <button onClick={() => setDangerOpen(true)} className="text-sm text-red-700 underline-offset-4 hover:underline dark:text-red-400">Delete account</button>
              <p className="mt-1 text-xs text-text-muted">Permanently deletes your account and everything synced to it.</p>
            </div>
          </Section>
        </div>
      </div>

      {dangerOpen && <ConfirmDialog onCancel={() => { if (!deleteBusy) setDangerOpen(false) }} onConfirm={() => void handleDeleteAccount()} busy={deleteBusy} error={deleteError} />}
    </main>
  )
}

function Section({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={`${id}-title`} className="font-display text-2xl font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Stat({ value, label, onClick }: { value: number; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group py-3 text-center transition-colors hover:bg-text-primary/[0.03]">
      <span className="block font-display text-2xl font-medium tabular-nums leading-none">{value}</span>
      <span className="mt-1 block text-xs text-text-muted group-hover:text-text-primary">{label}</span>
    </button>
  )
}

function CoverCollage({ items }: { items: ClothingItem[] }) {
  // Same lead-plus-two layout as the Kloset folders.
  return (
    <div className="grid aspect-[4/3] grid-cols-[3fr_2fr] grid-rows-2 gap-px overflow-hidden bg-text-primary/10">
      {[0, 1, 2].map((slot) => <CoverTile key={items[slot]?.id ?? `empty-${slot}`} item={items[slot]} lead={slot === 0} />)}
    </div>
  )
}

function CoverTile({ item, lead }: { item?: ClothingItem; lead: boolean }) {
  const url = useItemImage(item)
  const cutout = item?.imageSource === 'local'
  return (
    <div className={clsx('flex min-h-0 items-center justify-center overflow-hidden bg-tile', lead && 'row-span-2')}>
      {url
        ? <img src={url} alt="" className={clsx('h-full w-full mix-blend-multiply dark:mix-blend-normal', cutout ? 'object-contain p-[8%]' : 'object-cover')} />
        : <CategoryGlyph category={item?.category ?? (lead ? 'dresses' : 'shoes')} size={lead ? 48 : 32} className="text-text-primary/15" />}
    </div>
  )
}

const FOLDER_NAMES: Record<string, string> = { tops: 'Tops', bottoms: 'Bottoms', dresses: 'Dresses', outerwear: 'Woolens', shoes: 'Shoes', accessories: 'Accessories' }

function CategoryBreakdown({ items, onOpen }: { items: ClothingItem[]; onOpen: () => void }) {
  const counts = Object.keys(FOLDER_NAMES).map((category) => ({ category, count: items.filter((item) => item.category === category).length }))
  return (
    <div className="grid grid-cols-3 gap-px bg-text-primary/10 ring-1 ring-text-primary/10 sm:grid-cols-6">
      {counts.map(({ category, count }) => (
        <button key={category} onClick={onOpen} className="group flex flex-col items-center gap-2 bg-warm-cream px-2 py-5 transition-colors hover:bg-surface">
          <CategoryGlyph category={category} size={36} className={clsx('transition-transform duration-300 ease-editorial group-hover:-translate-y-0.5', count ? 'text-text-primary/70' : 'text-text-primary/20')} />
          <span className={clsx('text-xs', count ? 'text-text-primary' : 'text-text-muted')}>{FOLDER_NAMES[category]}</span>
          <span className="font-display text-xl font-medium leading-none tabular-nums">{count}</span>
        </button>
      ))}
    </div>
  )
}

function ColourBreakdown({ items }: { items: ClothingItem[] }) {
  const tally = new Map<string, number>()
  for (const item of items) {
    const colour = item.colour[0]?.toLowerCase()
    if (colour) tally.set(colour, (tally.get(colour) ?? 0) + 1)
  }
  const colours = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  if (!colours.length) return <p className="text-sm text-text-muted">Add colours to your pieces and your palette shows up here.</p>
  const total = colours.reduce((sum, [, count]) => sum + count, 0)
  const [top, second] = colours
  const summary = second && second[1] >= top[1] * 0.6 ? `Mostly ${top[0]} and ${second[0]}.` : `Mostly ${top[0]}.`
  return (
    <div>
      <p className="mb-4 font-display text-xl text-text-primary">{summary}</p>
      <div role="img" aria-label={`Your Kloset's colours: ${colours.map(([colour, count]) => `${colour} ${count}`).join(', ')}`} className="flex h-12 overflow-hidden ring-1 ring-inset ring-text-primary/10">
        {colours.map(([colour, count]) => (
          <span key={colour} title={`${colour}: ${count}`} className="h-full transition-[flex-grow] duration-700 ease-editorial" style={{ flexGrow: count, flexBasis: 0, backgroundColor: colourNameToHex(colour) }} />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {colours.map(([colour, count]) => (
          <li key={colour} className="inline-flex items-center gap-2 text-xs capitalize text-text-primary">
            <span className="h-3 w-3 rounded-full ring-1 ring-inset ring-text-primary/15" style={{ backgroundColor: colourNameToHex(colour) }} aria-hidden="true" />
            {colour} <span className="tabular-nums text-text-muted">{Math.round((count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChipList({ values }: { values: string[] }) {
  return <ul className="flex flex-wrap gap-2">{values.map((value) => <li key={value} className="rounded-full border border-text-primary/15 px-3 py-1 text-xs capitalize text-text-primary">{value}</li>)}</ul>
}

function ColourList({ colours }: { colours: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {colours.map((colour) => (
        <li key={colour} className="inline-flex items-center gap-2 rounded-full border border-text-primary/15 py-1 pl-1.5 pr-3 text-xs capitalize text-text-primary">
          <span className="h-4 w-4 rounded-full ring-1 ring-inset ring-text-primary/15" style={{ backgroundColor: colourNameToHex(colour) }} aria-hidden="true" />
          {colour}
        </li>
      ))}
    </ul>
  )
}

function PieceTile({ item, note, badge, onOpen, className }: { item: ClothingItem; note?: string; badge?: string; onOpen: () => void; className?: string }) {
  const url = useItemImage(item)
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${item.name} in your Kloset`} className={clsx('group block min-w-0 text-left', className)}>
      <div className="relative aspect-[3/4] overflow-hidden bg-tile">
        {badge && <span className="absolute left-2 top-2 z-10 rounded-full bg-text-primary px-2.5 py-1 text-2xs font-medium text-warm-cream">{badge}</span>}
        {url
          ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.015]" />
          : <div className="flex h-full items-center justify-center"><CategoryGlyph category={item.category} size={40} className="text-text-primary/20" /></div>}
      </div>
      <p className="mt-2.5 truncate font-display text-base leading-snug text-text-primary" title={item.name}>{item.name}</p>
      {note && <p className="mt-0.5 text-xs text-text-muted">{note}</p>}
    </button>
  )
}

// Load the sample basics, or remove them (only the sample pieces; their own stay).
// Removing asks for a second tap first.
function SampleKlosetRow() {
  const sampleKloset = useSampleKloset()
  const [confirming, setConfirming] = useState(false)
  const count = sampleKloset.samples.length
  if (!count) {
    return <SettingsRow icon={Shirt} title="Load a sample Kloset" subtitle="A few basics picked for your style, to try outfits with" onClick={() => { void sampleKloset.load(); notify('Sample Kloset added') }} />
  }
  return <SettingsRow
    icon={Trash2}
    title={confirming ? `Tap again to remove ${count} sample ${count === 1 ? 'piece' : 'pieces'}` : 'Remove sample Kloset'}
    subtitle={confirming ? 'Your own pieces stay' : `${count} sample ${count === 1 ? 'piece' : 'pieces'} in your Kloset`}
    onClick={() => {
      if (!confirming) { setConfirming(true); return }
      const removed = sampleKloset.remove()
      setConfirming(false)
      notify(`Removed ${removed} sample ${removed === 1 ? 'piece' : 'pieces'}`)
    }}
  />
}

function SettingsRow({ icon: Icon, title, subtitle, onClick }: { icon: LucideIcon; title: string; subtitle: string; onClick: () => void }) {
  return <button onClick={onClick} className="group flex w-full items-center gap-3 py-4 text-left"><Icon size={17} strokeWidth={1.5} className="shrink-0 text-text-muted transition-colors group-hover:text-text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm">{title}</span><span className="block truncate text-xs text-text-muted">{subtitle}</span></span><ChevronRight size={16} className="text-text-muted transition-transform group-hover:translate-x-0.5" /></button>
}

function ConfirmDialog({ onCancel, onConfirm, busy, error }: { onCancel: () => void; onConfirm: () => void; busy: boolean; error: string }) {
  return <ModalShell onClose={onCancel} label="Confirm account deletion"><div className="p-6"><h2 className="font-display text-3xl">Delete your account?</h2><p className="mt-3 text-sm leading-relaxed text-text-muted">This permanently deletes your account, profile, closet, and saved outfits. This cannot be undone.</p>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button onClick={onCancel} disabled={busy} className="px-4 py-2 text-sm text-text-muted disabled:opacity-50">Cancel</button><button onClick={onConfirm} disabled={busy} className="bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800 disabled:opacity-50">{busy ? 'Deleting…' : 'Delete account'}</button></div></div></ModalShell>
}

function ModalShell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-scrim/45 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-label={label} className="max-h-[90dvh] w-full max-w-xl overflow-hidden bg-surface text-text-primary shadow-lifted">{children}</section></div>
}
