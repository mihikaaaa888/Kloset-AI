import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive, Camera, ChevronRight, Cog, ImagePlus, LogOut, Pencil,
  Plus, X, type LucideIcon,
} from 'lucide-react'
import { clsx } from 'clsx'

import { ThemePicker } from '@/components/ui/ThemeToggle'
import { useItemImage } from '@/hooks/useItemImage'
import { colourNameToHex } from '@/lib/colourUtils'
import { getImage, saveImage } from '@/lib/imageStorage'
import { compressImage } from '@/lib/imageStorage'
import { ALL_CATALOG_ITEMS } from '@/lib/catalogData'
import { useAuth } from '@/contexts/AuthContext'
import { useUserStore } from '@/store/userStore'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useOutfitStore } from '@/store/outfitStore'
import { deleteWithUndo } from '@/store/undoStore'
import type { ClothingCategory, ClothingItem, Outfit } from '@/types'

const CARD = 'rounded-2xl bg-surface ring-1 ring-inset ring-text-primary/10 shadow-card transition-colors duration-500'
const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: 'Tops', bottoms: 'Bottoms', dresses: 'Dresses', outerwear: 'Outerwear', shoes: 'Shoes', accessories: 'Accessories',
}
const WEEK_LOG_KEY = 'kloset-profile-week-log'

function getInitials(name: string) {
  return name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2)
}

function weekKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekDays() {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
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
  const [logDay, setLogDay] = useState<string | null>(null)
  const [weekLog, setWeekLog] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(WEEK_LOG_KEY) ?? '{}') as Record<string, string> } catch { return {} }
  })
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
  const mostWornItems = wardrobeItems.filter((item) => item.timesWorn > 0).sort((a, b) => b.timesWorn - a.timesWorn).slice(0, 3)
  const neverWorn = wardrobeItems.filter((item) => item.timesWorn === 0).slice(0, 5)
  const weekDays = useMemo(getWeekDays, [])

  const categoryMix = useMemo(() => {
    const countsByCategory = wardrobeItems.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] ?? 0) + 1 }), {} as Partial<Record<ClothingCategory, number>>)
    return (Object.entries(countsByCategory) as [ClothingCategory, number][]).sort((a, b) => b[1] - a[1])
  }, [wardrobeItems])
  const closetPalette = useMemo(() => {
    const totals = new Map<string, number>()
    wardrobeItems.forEach((item) => item.colour.forEach((colour) => totals.set(colour, (totals.get(colour) ?? 0) + 1)))
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([colour]) => colour)
  }, [wardrobeItems])
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

  useEffect(() => {
    try { localStorage.setItem(WEEK_LOG_KEY, JSON.stringify(weekLog)) } catch (error) { console.error('[profile] could not save weekly outfit log', error) }
  }, [weekLog])

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
  const handleLogOutfit = (day: string, outfitId: string) => {
    setWeekLog((current) => ({ ...current, [day]: outfitId }))
    setLogDay(null)
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
  const logWeek = (next: Record<string, string>) => setWeekLog(next)

  return (
    <main className="min-h-screen bg-warm-cream pb-28 text-text-primary transition-colors duration-500 md:pb-12">
      <header className="relative isolate flex min-h-[14rem] items-center overflow-hidden bg-[#355E3B] py-8 text-[#FFFDD0] sm:min-h-[16rem] lg:min-h-[17rem]">
        {coverItems.length > 0 ? <div className="absolute inset-0 -z-10 grid grid-cols-3 opacity-45 sm:grid-cols-5">{coverItems.map((item) => <CoverImage key={item.id} item={item} />)}</div> : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17351f]/90 via-[#24482e]/75 to-[#355E3B]/45" />
        <div className="mx-auto flex w-full max-w-6xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => avatarInput.current?.click()} aria-label="Upload profile photo" className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-[#FFFDD0]/50 bg-[#FFFDD0]/15 shadow-card sm:h-28 sm:w-28">
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-display text-3xl">{getInitials(profile.name)}</span>}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Camera size={20} /></span>
          </button>
          <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => { void handleAvatar(event.target.files?.[0]); event.target.value = '' }} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-4xl leading-none sm:text-6xl">{profile.name}</h1>
          </div>
          <button onClick={handleEditProfile} aria-label="Edit profile" title="Edit profile" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#FFFDD0]/40 text-[#FFFDD0] transition-colors hover:bg-[#FFFDD0] hover:text-[#355E3B]"><Pencil size={16} /></button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-4 pt-9 sm:px-6 lg:px-8 lg:pt-12">
        <section aria-labelledby="closet-stats-heading">
          <SectionHeading id="closet-stats-heading" title="Your Kloset" />
          <section className={clsx(CARD, 'relative overflow-hidden p-5 sm:p-6')}>
              <h3 className="mb-4 font-sans text-base font-medium sm:text-lg">Most Worn</h3>
              {mostWornItems.length > 0 ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{mostWornItems.map((item) => <MostWornPiece key={item.id} item={item} onOpen={() => navigate('/wardrobe')} />)}</div> : <button onClick={() => navigate('/wardrobe')} className="text-sm underline underline-offset-4">Add a piece</button>}
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

        <section aria-labelledby="week-heading">
          <SectionHeading id="week-heading" title="Log outfit" />
          <div className={clsx(CARD, 'grid grid-cols-4 gap-2 p-3 sm:grid-cols-7 sm:gap-3 sm:p-5')}>
            {weekDays.map((date) => {
              const key = weekKey(date)
              const outfit = savedOutfits.find((candidate) => candidate.id === weekLog[key])
              return <WeekDay key={key} date={date} outfit={outfit} wardrobe={wardrobeItems} onClick={() => outfit ? logWeek(Object.fromEntries(Object.entries(weekLog).filter(([day]) => day !== key))) : setLogDay(key)} />
            })}
          </div>
        </section>

        <section aria-labelledby="dna-heading">
          <SectionHeading id="dna-heading" title="Style DNA" />
          <div className={clsx(CARD, 'grid gap-7 p-5 sm:p-7 md:grid-cols-2')}>
            <div><p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-text-muted">Your palette</p>{closetPalette.length ? <div className="flex flex-wrap gap-3">{closetPalette.map((colour) => <div key={colour} className="flex items-center gap-2 text-sm capitalize"><span className="h-7 w-7 rounded-full ring-1 ring-inset ring-text-primary/15" style={{ backgroundColor: colourNameToHex(colour) }} />{colour}</div>)}</div> : <div><p className="mb-2 text-sm text-text-muted">Add pieces with colour details to see your palette.</p><button onClick={() => navigate('/wardrobe')} className="text-xs underline underline-offset-4">Add a piece</button></div>}</div>
            <div><p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-text-muted">Category mix</p>{categoryMix.length ? <div className="space-y-3">{categoryMix.map(([category, count]) => <div key={category} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 text-xs"><span>{CATEGORY_LABELS[category]}</span><span className="h-1.5 overflow-hidden rounded-full bg-text-primary/8"><span className="block h-full rounded-full bg-butter-yellow" style={{ width: `${Math.max(8, (count / wardrobeItems.length) * 100)}%` }} /></span><span className="text-right tabular-nums text-text-muted">{count}</span></div>)}</div> : <div><p className="mb-2 text-sm text-text-muted">Your category mix will appear as you add pieces.</p><button onClick={() => navigate('/wardrobe')} className="text-xs underline underline-offset-4">Add a piece</button></div>}</div>
          </div>
        </section>

        <div className="flex justify-end pb-3"><button onClick={() => setSettingsOpen(true)} aria-label="Open settings" className="inline-flex items-center gap-2 px-2 py-2 text-sm text-text-muted transition-colors hover:text-text-primary"><Cog size={17} /> Settings</button></div>
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} onEdit={handleEditProfile} onRecycle={() => { setSettingsOpen(false); navigate('/wardrobe?view=outfits&recycle=1') }} onSignOut={handleSignOut} onClear={() => setDangerOpen(true)} email={user?.email} />}
      {dangerOpen && <ConfirmDialog onCancel={() => setDangerOpen(false)} onConfirm={handleClearAll} />}
      {logDay && <LogOutfitDialog day={logDay} outfits={savedOutfits} onSelect={handleLogOutfit} onClose={() => setLogDay(null)} onCreate={() => { setLogDay(null); navigate('/wardrobe?view=outfits') }} />}
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

function MostWornPiece({ item, onOpen }: { item: ClothingItem; onOpen: () => void }) {
  const url = useItemImage(item)
  return <article className="min-w-0 overflow-hidden rounded-xl bg-tile/60">
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

function WeekDay({ date, outfit, wardrobe, onClick }: { date: Date; outfit?: Outfit; wardrobe: ClothingItem[]; onClick: () => void }) {
  const item = outfit ? wardrobe.find((piece) => piece.id === outfit.items[0]?.itemId) : undefined
  const itemUrl = useItemImage(item)
  const imageUrl = itemUrl ?? outfit?.items.find((piece) => piece.snapshot?.imageUrl)?.snapshot?.imageUrl
  const today = weekKey(date) === weekKey(new Date())
  return <button onClick={onClick} aria-label={`${date.toLocaleDateString('en', { weekday: 'long' })}${outfit ? `: ${outfit.name}` : ', log outfit'}`} className="group min-w-0 text-center"><span className={clsx('mb-2 block text-[10px] uppercase tracking-widest', today ? 'text-butter-yellow' : 'text-text-muted')}>{date.toLocaleDateString('en', { weekday: 'short' })}</span><span className={clsx('relative mx-auto flex aspect-square w-full max-w-20 items-center justify-center overflow-hidden rounded-xl border border-text-primary/10 bg-tile transition-colors group-hover:border-text-primary/35', today && 'ring-1 ring-butter-yellow/50')}>{imageUrl ? <img src={imageUrl} alt={outfit?.name ?? ''} className="h-full w-full object-cover" /> : <Plus size={16} className="text-text-muted" />}</span>{outfit && <span className="mt-1.5 block truncate text-[10px] text-text-muted">{outfit.name}</span>}</button>
}

function LogOutfitDialog({ day, outfits, onSelect, onClose, onCreate }: { day: string; outfits: Outfit[]; onSelect: (day: string, outfitId: string) => void; onClose: () => void; onCreate: () => void }) {
  return <ModalShell onClose={onClose} label="Log an outfit"><div className="max-h-[75vh] overflow-y-auto p-5 sm:p-7"><div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">This week</p><h2 className="mt-1 font-display text-3xl">Log an outfit</h2><p className="mt-1 text-sm text-text-muted">{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p></div><button onClick={onClose} aria-label="Close" className="p-1 text-text-muted"><X size={18} /></button></div>{outfits.length ? <div className="space-y-2">{outfits.map((outfit) => <button key={outfit.id} onClick={() => onSelect(day, outfit.id)} className="flex w-full items-center justify-between gap-4 border-b border-text-primary/10 py-3 text-left hover:text-butter-yellow"><span><span className="block font-display text-xl">{outfit.name}</span><span className="text-xs text-text-muted">{outfit.items.length} pieces · {outfit.occasion.replace('-', ' ')}</span></span><ChevronRight size={17} /></button>)}</div> : <div className="py-6 text-center"><p className="mb-4 text-sm text-text-muted">Save an outfit first, then you can log it here.</p><button onClick={onCreate} className="border-b border-text-primary/40 pb-1 text-sm">Go to outfits</button></div>}</div></ModalShell>
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
