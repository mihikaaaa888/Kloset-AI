import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import { Modal } from '@/components/ui/Modal'
import { useItemImage } from '@/hooks/useItemImage'
import type { ClothingItem, Outfit } from '@/types'

const WEEK_LOG_KEY = 'kloset-profile-week-log'
const CARD = 'rounded-2xl bg-surface ring-1 ring-inset ring-text-primary/10 shadow-card'

function dateKey(date: Date) {
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

/** Weekly outfit logging is available from the Outfits view. */
export function LogOutfitWeek({ outfits, wardrobe, onCreate }: { outfits: Outfit[]; wardrobe: ClothingItem[]; onCreate: () => void }) {
  const weekDays = useMemo(getWeekDays, [])
  const [weekLog, setWeekLog] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(WEEK_LOG_KEY) ?? '{}') as Record<string, string> } catch { return {} }
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(WEEK_LOG_KEY, JSON.stringify(weekLog)) } catch (error) { console.error('[outfits] could not save weekly outfit log', error) }
  }, [weekLog])

  const selectOutfit = (day: string, outfitId: string) => {
    setWeekLog((current) => ({ ...current, [day]: outfitId }))
    setSelectedDay(null)
  }

  return <>
    <section className="mt-10" aria-labelledby="week-log-heading">
      <div className="mb-4"><h2 id="week-log-heading" className="font-display text-3xl sm:text-4xl">Log outfit</h2></div>
      <div className={`${CARD} grid grid-cols-4 gap-2 p-3 sm:grid-cols-7 sm:gap-3 sm:p-5`}>
        {weekDays.map((date) => {
          const key = dateKey(date)
          const outfit = outfits.find((candidate) => candidate.id === weekLog[key])
          return <WeekDay key={key} date={date} outfit={outfit} wardrobe={wardrobe} onClick={() => {
            if (outfit) setWeekLog((current) => Object.fromEntries(Object.entries(current).filter(([day]) => day !== key)))
            else setSelectedDay(key)
          }} />
        })}
      </div>
    </section>

    <Modal open={!!selectedDay} onClose={() => setSelectedDay(null)} title="Log an outfit" variant="sheet">
      <div className="px-6 pb-6">
        <p className="mb-4 text-sm text-text-muted">{selectedDay ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ''}</p>
        {outfits.length ? <div className="divide-y divide-text-primary/10">
          {outfits.map((outfit) => <button key={outfit.id} onClick={() => selectedDay && selectOutfit(selectedDay, outfit.id)} className="flex w-full items-center justify-between gap-4 py-3 text-left hover:text-butter-yellow">
            <span><span className="block font-display text-xl">{outfit.name}</span><span className="text-xs text-text-muted">{outfit.items.length} pieces · {outfit.occasion.replace('-', ' ')}</span></span>
            <span className="text-xs">Add</span>
          </button>)}
        </div> : <div className="py-4 text-center"><p className="mb-4 text-sm text-text-muted">Save an outfit first, then you can log it here.</p><button onClick={onCreate} className="border-b border-text-primary/40 pb-1 text-sm">Create an outfit</button></div>}
      </div>
    </Modal>
  </>
}

function WeekDay({ date, outfit, wardrobe, onClick }: { date: Date; outfit?: Outfit; wardrobe: ClothingItem[]; onClick: () => void }) {
  const item = outfit ? wardrobe.find((piece) => piece.id === outfit.items[0]?.itemId) : undefined
  const itemUrl = useItemImage(item)
  const imageUrl = itemUrl ?? outfit?.items.find((piece) => piece.snapshot?.imageUrl)?.snapshot?.imageUrl
  const today = dateKey(date) === dateKey(new Date())
  return <button onClick={onClick} aria-label={`${date.toLocaleDateString('en', { weekday: 'long' })}${outfit ? `: ${outfit.name}; tap to remove` : ', log outfit'}`} className="group min-w-0 text-center">
    <span className={`mb-2 block text-[10px] uppercase tracking-widest ${today ? 'text-butter-yellow' : 'text-text-muted'}`}>{date.toLocaleDateString('en', { weekday: 'short' })}</span>
    <span className={`relative mx-auto flex aspect-square w-full max-w-20 items-center justify-center overflow-hidden rounded-xl border border-text-primary/10 bg-tile transition-colors group-hover:border-text-primary/35 ${today ? 'ring-1 ring-butter-yellow/50' : ''}`}>
      {imageUrl ? <img src={imageUrl} alt={outfit?.name ?? ''} className="h-full w-full object-cover" /> : <Plus size={16} className="text-text-muted" />}
    </span>
    {outfit && <span className="mt-1.5 block truncate text-[10px] text-text-muted">{outfit.name}</span>}
  </button>
}
