import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive, Camera, ChevronRight, Cog, ImagePlus, LogOut, Pencil,
  X, type LucideIcon,
} from 'lucide-react'
import { clsx } from 'clsx'

import { ThemePicker } from '@/components/ui/ThemeToggle'
import { useItemImage } from '@/hooks/useItemImage'
import { getImage, saveImage } from '@/lib/imageStorage'
import { compressImage } from '@/lib/imageStorage'
import { ALL_CATALOG_ITEMS } from '@/lib/catalogData'
import { useAuth } from '@/contexts/AuthContext'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useOutfitStore } from '@/store/outfitStore'
import { deleteWithUndo } from '@/store/undoStore'
import type { ClothingItem } from '@/types'

const CARD = 'rounded-2xl bg-surface ring-1 ring-inset ring-text-primary/10 shadow-card transition-colors duration-500'

function getInitials(name: string) {
  return name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2)
}

export function ProfilePage() {
  const navigate = useNavigate()
  const profile = useUserStore((state) => state.profile)
  const clearProfile = useUserStore((state) => state.clearProfile)
  const wardrobeItems = useWardrobeStore((state) => state.items)
  const removeWardrobeItem = useWardrobeStore((state) => state.removeItem)
  const savedOutfits = useOutfitStore((state) => state.savedOutfits)
  const clearOutfits = useOutfitStore((state) => state.clearOutfits)
  const { user, signOut } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [counts, setCounts] = useState({ pieces: 0, outfits: 0, costPerWear: 0 })
  const avatarInput = useRef<HTMLInputElement>(null)

  const pricedWears = useMemo(() => wardrobeItems.reduce((summary, item) => {
    if (!item.catalogId || item.timesWorn <= 0) return summary
    const catalogItem = ALL_CATALOG_ITEMS.find((candidate) => candidate.id === item.catalogId)
    if (!catalogItem) return summary
    return { total: summary.total + catalogItem.estimatedPrice, wears: summary.wears + item.timesWorn }
  }, { total: 0, wears: 0 }), [wardrobeItems])
  const costPerWear = pricedWears.wears ? Math.round(pricedWears.total / pricedWears.wears) : null
  const mostWornItems = wardrobeItems.filter((item) => item.timesWorn > 0).sort((a, b) => b.timesWorn - a.timesWorn).slice(0, 4)
  const neverWorn = wardrobeItems.filter((item) => item.timesWorn === 0).slice(0, 5)
  const coverItems = wardrobeItems.filter((item) => item.imageUrl || item.imageId || item.imageStoragePath).slice(0, 5)

  useEffect(() => {
    setCounts({ pieces: wardrobeItems.length, outfits: savedOutfits.length, costPerWear: costPerWear ?? 0 })
    const id = profile ? localStorage.getItem(`kloset-profile-avatar:${profile.id}`) : null
    setAvatarId(id)
  }, [profile?.id, wardrobeItems.length, savedOutfits.length, costPerWear])

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

  const handleEditProfile = () => { setSettingsOpen(false); navigate('/onboarding?edit=true') }
  const handleAvatar = async (file?: File) => {
    if (!file || !profile) return
    try {
      const id = await saveImage(await compressImage(file))
      localStorage.setItem(`kloset-profile-avatar:${profile.id}`, id)
      setAvatarId(id)
    } catch (error) { console.error('[profile] avatar upload failed', error) }
  }
  const handleClearAll = () => {
    const { profile: savedProfile, loadedForUserId } = useUserStore.getState()
    const items = useWardrobeStore.getState().items
    const { savedOutfits: outfits, trashedOutfits } = useOutfitStore.getState()
    deleteWithUndo({
      message: 'Everything cleared',
      remove: () => { items.forEach((item) => removeWardrobeItem(item.id)); clearOutfits(); clearProfile(); setDangerOpen(false); setSettingsOpen(false); navigate('/') },
      restore: () => {
        useWardrobeStore.getState().setItems(items)
        useOutfitStore.setState({ savedOutfits: outfits, trashedOutfits })
        if (savedProfile) useUserStore.getState().setProfile(savedProfile)
        useUserStore.getState().markLoaded(loadedForUserId)
        navigate('/profile')
      },
    })
  }
  const handleSignOut = async () => {
    try { await signOut(); setSettingsOpen(false); navigate('/') } catch (error) { console.error('[profile] sign out failed', error) }
  }
  return (
    <main className="min-h-screen bg-warm-cream pb-28 text-text-primary transition-colors duration-500 md:pb-12">
      <header className="relative isolate flex min-h-[14rem] items-center overflow-hidden bg-[#355E3B] py-8 text-[#FFFDD0] sm:min-h-[16rem] lg:min-h-[17rem]">
        {coverItems.length > 0 ? <div className="absolute inset-0 -z-10 grid grid-cols-3 opacity-45 sm:grid-cols-5">{coverItems.map((item) => <CoverImage key={item.id} item={item} />)}</div> : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17351f]/90 via-[#24482e]/75 to-[#355E3B]/45" />
        <div className="mx-auto flex w-full max-w-6xl translate-y-3 items-center gap-5 px-4 sm:translate-y-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => avatarInput.current?.click()} aria-label="Upload profile photo" className="group relative h-12 w-12 shrink-0 translate-y-3 overflow-hidden rounded-full border border-[#FFFDD0]/50 bg-[#FFFDD0]/15 shadow-card sm:h-16 sm:w-16 sm:translate-y-4">
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-display text-lg sm:text-xl">{getInitials(profile.name)}</span>}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Camera size={20} /></span>
          </button>
          <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => { void handleAvatar(event.target.files?.[0]); event.target.value = '' }} />
          <div className="min-w-0 flex-1 translate-y-3 sm:translate-y-4">
            <h1 className="truncate font-display text-4xl leading-none sm:text-6xl">{profile.name}</h1>
          </div>
          <button onClick={handleEditProfile} aria-label="Edit profile" title="Edit profile" className="flex h-10 w-10 shrink-0 translate-y-3 items-center justify-center rounded-full border border-[#FFFDD0]/40 text-[#FFFDD0] transition-colors hover:bg-[#FFFDD0] hover:text-[#355E3B] sm:translate-y-4"><Pencil size={16} /></button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-4 pt-9 sm:px-6 lg:px-8 lg:pt-12">
        <section aria-labelledby="closet-stats-heading">
          <SectionHeading id="closet-stats-heading" title="Your Kloset" />
          <section className={clsx(CARD, 'relative overflow-hidden p-5 sm:p-6')}>
              <h3 className="mb-4 font-sans text-base font-medium sm:text-lg">Most Worn</h3>
              {mostWornItems.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">{mostWornItems.map((item, index) => <MostWornPiece key={item.id} item={item} className={index === 3 ? 'sm:hidden' : undefined} onOpen={() => navigate('/wardrobe')} />)}</div> : <button onClick={() => navigate('/wardrobe')} className="text-sm underline underline-offset-4">Add a piece</button>}
          </section>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Pieces" value={counts.pieces} action={counts.pieces === 0 ? 'Add your first piece' : undefined} onClick={() => navigate('/wardrobe')} />
            <StatTile label="Outfits" value={counts.outfits} action={counts.outfits === 0 ? 'Create an outfit' : undefined} onClick={() => navigate('/wardrobe?view=outfits')} />
            <StatTile label="Cost per wear" value={costPerWear} prefix="₹" action={costPerWear === null ? 'Browse shop to start tracking' : undefined} onClick={() => navigate('/discover')} />
          </div>

          <section className={clsx(CARD, 'mt-3 p-5 sm:p-6')}>
            <div className="mb-3"><h3 className="font-sans text-base font-medium sm:text-lg">Never worn</h3></div>
            {neverWorn.length ? <div className="flex gap-3 overflow-x-auto pb-1">{neverWorn.map((item) => <NeverWornPiece key={item.id} item={item} />)}</div> : wardrobeItems.length === 0 ? <div className="py-4"><p className="mb-3 text-sm text-text-muted">Your closet is empty for now.</p><button onClick={() => navigate('/wardrobe')} className="text-xs underline underline-offset-4">Add your first piece</button></div> : <p className="py-4 text-sm text-text-muted">Everything has had a turn. Keep logging wears to update this list.</p>}
          </section>
        </section>

        <div className="flex justify-end pb-3"><button onClick={() => setSettingsOpen(true)} aria-label="Open settings" className="inline-flex items-center gap-2 px-2 py-2 text-sm text-text-muted transition-colors hover:text-text-primary"><Cog size={17} /> Settings</button></div>
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} onEdit={handleEditProfile} onRecycle={() => { setSettingsOpen(false); navigate('/wardrobe?view=outfits&recycle=1') }} onSignOut={handleSignOut} onClear={() => setDangerOpen(true)} email={user?.email} />}
      {dangerOpen && <ConfirmDialog onCancel={() => setDangerOpen(false)} onConfirm={handleClearAll} />}
    </main>
  )
}

function SectionHeading({ id, title }: { id: string; title: string }) {
  return <div className="mb-4"><h2 id={id} className="font-display text-3xl sm:text-4xl">{title}</h2></div>
}

function CountedValue({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 650)
      setShown(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{prefix}{shown.toLocaleString('en-IN')}</>
}

function StatTile({ label, value, prefix, action, onClick }: { label: string; value: number | null; prefix?: string; action?: string; onClick: () => void }) {
  return <button onClick={onClick} className={clsx(CARD, 'flex min-h-32 flex-col items-start justify-between p-5 text-left transition-colors hover:bg-text-primary/[0.02]')}>
    <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</span>
    <span className="font-display text-4xl tabular-nums">{value === null ? '—' : <CountedValue value={value} prefix={prefix} />}</span>
    {action && <span className="text-xs underline underline-offset-4">{action}</span>}
  </button>
}

function CoverImage({ item }: { item: ClothingItem }) {
  const url = useItemImage(item)
  return <div className="relative min-h-full overflow-hidden">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-[#355E3B]" />}<div className="absolute inset-0 bg-[#355E3B]/35" /></div>
}

function MostWornPiece({ item, onOpen, className }: { item: ClothingItem; onOpen: () => void; className?: string }) {
  const url = useItemImage(item)
  return <article className={clsx('min-w-0 overflow-hidden rounded-xl bg-tile/60', className)}>
    <button type="button" onClick={onOpen} className="block aspect-[4/3] w-full overflow-hidden bg-tile" aria-label={`Open ${item.name}`}>
      {url ? <img src={url} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]" /> : <div className="h-full w-full bg-tile" />}
    </button>
    <div className="p-3"><p className="truncate text-sm" title={item.name}>{item.name}</p><p className="mt-1 text-xs text-text-muted">Worn {item.timesWorn} {item.timesWorn === 1 ? 'time' : 'times'}</p></div>
  </article>
}

function NeverWornPiece({ item }: { item: ClothingItem }) {
  const url = useItemImage(item)
  return <article className="w-36 shrink-0 sm:w-40"><div className="aspect-[4/5] overflow-hidden rounded-2xl bg-tile">{url ? <img src={url} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImagePlus className="text-text-muted/50" /></div>}</div><p className="mt-2 truncate text-xs" title={item.name}>{item.name}</p></article>
}

function SettingsSheet({ onClose, onEdit, onRecycle, onSignOut, onClear, email }: { onClose: () => void; onEdit: () => void; onRecycle: () => void; onSignOut: () => void; onClear: () => void; email?: string }) {
  return <ModalShell onClose={onClose} label="Profile settings"><div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Profile</p><h2 className="font-display text-3xl">Settings</h2></div><button onClick={onClose} aria-label="Close settings" className="p-2 text-text-muted hover:text-text-primary"><X size={18} /></button></div>
    <div className="divide-y divide-text-primary/10 border-y border-text-primary/10">
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm">Appearance</p><p className="text-xs text-text-muted">Choose Light, Dark, or System</p></div><ThemePicker /></div>
      <SettingsRow icon={Pencil} title="Edit style" subtitle="Update your style preferences" onClick={onEdit} />
      <SettingsRow icon={Archive} title="Recycle bin" subtitle="Restore or permanently delete saved outfits" onClick={onRecycle} />
      <SettingsRow icon={LogOut} title="Sign out" subtitle={email ?? 'Sign out of your account'} onClick={onSignOut} />
    </div>
    <div className="mt-7 border-t border-red-700/20 pt-5"><p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-red-700 dark:text-red-400">Danger zone</p><button onClick={onClear} className="text-sm text-red-700 underline underline-offset-4 dark:text-red-400">Clear data</button><p className="mt-1 text-xs text-text-muted">Permanently remove your profile, closet, and saved outfits.</p></div>
  </div></ModalShell>
}

function SettingsRow({ icon: Icon, title, subtitle, onClick }: { icon: LucideIcon; title: string; subtitle: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:text-butter-yellow"><Icon size={17} className="shrink-0 text-butter-yellow" /><span className="min-w-0 flex-1"><span className="block text-sm">{title}</span><span className="block truncate text-xs text-text-muted">{subtitle}</span></span><ChevronRight size={16} className="text-text-muted" /></button>
}

function ConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <ModalShell onClose={onCancel} label="Confirm clearing profile data"><div className="p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-red-700 dark:text-red-400">Danger zone</p><h2 className="mt-2 font-display text-3xl">Clear your data?</h2><p className="mt-3 text-sm leading-relaxed text-text-muted">Your profile, closet, and saved outfits will be removed. You can undo this from the confirmation notice.</p><div className="mt-6 flex justify-end gap-3"><button onClick={onCancel} className="px-4 py-2 text-sm text-text-muted">Cancel</button><button onClick={onConfirm} className="bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800">Clear data</button></div></div></ModalShell>
}

function ModalShell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-label={label} className="max-h-[90dvh] w-full max-w-xl overflow-hidden rounded-t-2xl bg-surface text-text-primary shadow-card sm:rounded-2xl">{children}</section></div>
}
