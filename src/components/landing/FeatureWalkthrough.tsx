import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Camera, MessageCircle, ShoppingBag, CalendarDays, Heart, Sparkles, ArrowUp, RotateCcw, Send } from 'lucide-react'
import { clsx } from 'clsx'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { PIECES, pieceById } from './landingData'
import { Hint, OvalTag } from './ornaments'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const img = (name: string) => `/images/landing/sm/${name}-on-hanger.webp`

// ── Demo data ────────────────────────────────────────────────────────────────

interface RollPiece { id: string; name: string; image: string; tags: string[] }

/** Photos waiting in the "camera roll" for step one. */
const ROLL: RollPiece[] = [
  { id: 'fur', name: 'Cream faux-fur coat', image: img('cream-faux-fur-coat'), tags: ['Outerwear', 'Cream', 'Faux fur', 'Winter'] },
  { id: 'suede', name: 'Chocolate suede jacket', image: img('chocolate-suede-belted-jacket'), tags: ['Outerwear', 'Chocolate', 'Suede', 'Smart casual'] },
  { id: 'shirt', name: 'Burgundy button-up', image: img('burgundy-button-up-shirt'), tags: ['Top', 'Burgundy', 'Button-up', 'Work'] },
  { id: 'olive', name: 'Olive gathered skirt', image: img('olive-gathered-skirt'), tags: ['Skirt', 'Olive', 'Gathered', 'Date night'] },
]

const CONVOS = [
  {
    chip: 'Dinner, humid night',
    ask: "Dinner in Bandra tonight and it's humid. What do I wear?",
    reply: 'Keep it light. Your chartreuse wrap top with the olive skirt, gold hoops, and flat sandals for the walk.',
    picks: [img('chartreuse-wrap-top'), img('olive-gathered-skirt'), img('pale-blue-wrap-skirt')],
  },
  {
    chip: 'Meeting, then drinks',
    ask: 'Client meeting at 10, drinks after. One outfit?',
    reply: 'The navy pinstripe set. At drinks, lose the jacket and throw the burgundy knit over your shoulders.',
    picks: [img('navy-pinstripe-set'), img('burgundy-rib-knit-top')],
  },
  {
    chip: 'Monsoon weekend',
    ask: 'Monsoon weekend, lots of walking. Help?',
    reply: 'Wide-leg denim with the navy overshirt, and sneakers that can take a puddle. Leave the suede at home.',
    picks: [img('navy-denim-clothing'), img('white-trousers')],
  },
  {
    chip: "Cousin's sangeet",
    ask: "Cousin's sangeet on Friday. I want colour!",
    reply: 'The red asymmetric skirt with a pale blue blouse. Gold drop earrings and block heels so you can dance.',
    picks: [img('red-asymmetric-skirt'), img('pale-blue-wrap-skirt')],
  },
]

const SHOP = [
  { name: 'Cream faux-fur coat', image: img('cream-faux-fur-coat'), buy: 4990, rent: 890 },
  { name: 'Chocolate suede jacket', image: img('chocolate-suede-belted-jacket'), buy: 3590, rent: 690 },
  { name: 'Navy pinstripe set', image: img('navy-pinstripe-set'), buy: 2790, rent: 540 },
  { name: 'Burgundy leather jacket', image: img('burgundy-leather-zip-jacket'), buy: 4290, rent: 790 },
]
const BUDGET = { buy: { min: 2500, max: 5000, step: 250 }, rent: { min: 500, max: 900, step: 50 } } as const

const FRIDAY = [
  { label: 'Red skirt look', pieces: [img('red-asymmetric-skirt')] },
  { label: 'Floral midi', pieces: [img('floral-midi-dress')] },
  { label: 'Chartreuse and olive', pieces: [img('chartreuse-wrap-top'), img('olive-gathered-skirt')] },
]
const REACTIONS = [
  { who: 'Aanya', initials: 'AR', text: 'loved your Friday look' },
  { who: 'Kabir', initials: 'KM', text: 'says: that one, obviously' },
  { who: 'Ishita', initials: 'IS', text: 'wants to borrow it after' },
]

interface DemoState {
  added: RollPiece | null
  setAdded: (p: RollPiece | null) => void
  convo: number
  setConvo: (i: number) => void
  mode: 'buy' | 'rent'
  setMode: (m: 'buy' | 'rent') => void
  budget: number
  setBudget: (n: number) => void
  friday: number
  setFriday: (i: number) => void
  asks: number
  setAsks: (n: number) => void
}

// ── Phone screens ────────────────────────────────────────────────────────────

function PhoneHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-text-primary/10 px-5 pb-3 pt-5">
      <p className="font-display text-2xl font-medium text-text-primary">{title}</p>
      {children}
    </div>
  )
}

function WardrobeScreen({ active, demo }: { active: boolean; demo: DemoState }) {
  const tagged = demo.added ?? { id: PIECES[0].id, name: PIECES[0].name, image: PIECES[0].image, tags: PIECES[0].tags }
  const grid = demo.added ? [{ id: demo.added.id, image: demo.added.image }, ...PIECES.slice(0, 5)] : PIECES
  return (
    <div className="relative flex h-full flex-col">
      <PhoneHeader title="My Kloset">
        <span className="rounded-full bg-butter-yellow px-3 py-1.5 text-[11px] font-semibold text-dark-purple">+ Add</span>
      </PhoneHeader>
      <div className="flex gap-4 px-5 pt-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        <span className="border-b border-butter-yellow pb-1 text-butter-yellow">All</span>
        <span>Tops</span>
        <span>Bottoms</span>
        <span>Outerwear</span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        {grid.map((p, i) => (
          <div key={p.id} className={clsx('relative aspect-[3/4] overflow-hidden rounded-2xl bg-tile', i === 0 && demo.added && 'chip-pop')}>
            <img src={p.image} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
            {i === 0 && active && (
              <span key={tagged.id} className="scan-line pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-butter-yellow/30 to-transparent" />
            )}
          </div>
        ))}
      </div>
      {active && (
        <div key={tagged.id} className="chip-pop absolute inset-x-3 bottom-3 rounded-[1.25rem] bg-surface p-4 shadow-lifted" style={{ ['--d' as string]: '900ms' }}>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Sparkles size={13} className="text-butter-yellow" /> Tagged {tagged.name.toLowerCase()}
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {tagged.tags.map((tag, t) => (
              <li key={tag} className="chip-pop rounded-full bg-tile px-2.5 py-1 text-[11px] font-medium text-text-primary" style={{ ['--d' as string]: `${1100 + t * 120}ms` }}>
                {tag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ChatScreen({ active, demo }: { active: boolean; demo: DemoState }) {
  const convo = CONVOS[demo.convo]
  const [replied, setReplied] = useState(false)
  useEffect(() => {
    setReplied(false)
    if (!active) return
    const t = window.setTimeout(() => setReplied(true), 1300)
    return () => window.clearTimeout(t)
  }, [active, demo.convo])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-text-primary/10 px-5 pb-3 pt-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-butter-yellow text-dark-purple"><HangerIcon size={18} /></span>
        <div>
          <p className="font-display text-xl font-medium leading-none text-text-primary">Kaia</p>
          <p className="mt-1 text-[11px] text-text-muted">Your stylist, knows your closet</p>
        </div>
      </div>
      <div key={demo.convo} className="flex flex-1 flex-col gap-3 overflow-hidden px-4 py-4 text-[13px] leading-relaxed">
        <div className="fade-swap ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-dark-purple px-3.5 py-2.5 text-text-primary">{convo.ask}</div>
        {!replied ? (
          <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-bl-md bg-surface px-3 py-3 shadow-card" aria-label="Kaia is typing">
            {[0, 150, 300].map((d) => <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-text-primary" style={{ ['--d' as string]: `${d}ms` }} />)}
          </div>
        ) : (
          <>
            <div className="fade-swap max-w-[88%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-text-primary shadow-card">{convo.reply}</div>
            <div className="flex gap-2">
              {convo.picks.map((src, i) => (
                <div key={src} className="chip-pop w-[30%] overflow-hidden rounded-2xl bg-surface p-1.5 shadow-card" style={{ ['--d' as string]: `${200 + i * 140}ms` }}>
                  <img src={src} alt="" loading="lazy" className="aspect-[3/4] w-full rounded-xl bg-tile object-contain" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="m-3 flex items-center justify-between rounded-2xl border border-text-primary/15 bg-surface py-2 pl-4 pr-2 text-[13px] text-text-muted">
        Ask Kaia anything
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-butter-yellow text-dark-purple"><ArrowUp size={15} /></span>
      </div>
    </div>
  )
}

function ShopScreen({ demo }: { active: boolean; demo: DemoState }) {
  const price = (item: (typeof SHOP)[number]) => (demo.mode === 'buy' ? item.buy : item.rent)
  return (
    <div className="flex h-full flex-col">
      <PhoneHeader title="Shop">
        <span className="rounded-full bg-tile px-3 py-1.5 text-[11px] font-semibold capitalize text-text-primary">{demo.mode}</span>
      </PhoneHeader>
      <p className="px-5 pt-3 text-[11px] text-text-muted">
        Under {inr.format(demo.budget)}{demo.mode === 'rent' ? ' a week' : ''}, picked to fill a gap
      </p>
      <div className="grid grid-cols-2 gap-3 p-4">
        {SHOP.map((item) => {
          const fits = price(item) <= demo.budget
          return (
            <div key={item.name} className={clsx('transition-opacity duration-300', !fits && 'opacity-30')}>
              <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-tile">
                <img src={item.image} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
              </div>
              <p className="mt-1.5 truncate text-[11px] text-text-primary">{item.name}</p>
              <p className="text-xs font-semibold text-text-primary">
                {inr.format(price(item))}{demo.mode === 'rent' ? ' / week' : ''}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-auto px-5 pb-4 text-[10px] text-text-muted">Example prices</p>
    </div>
  )
}

function WeekScreen({ active, demo }: { active: boolean; demo: DemoState }) {
  const week = [
    { day: 'Mon', plan: 'Office', pieces: [img('navy-pinstripe-set')] },
    { day: 'Wed', plan: 'Coffee date', pieces: [pieceById('wrap').image] },
    { day: 'Fri', plan: 'Sangeet', pieces: FRIDAY[demo.friday].pieces },
    { day: 'Sun', plan: 'Brunch', pieces: [pieceById('denim').image] },
  ]
  const reaction = demo.asks > 0 ? REACTIONS[(demo.asks - 1) % REACTIONS.length] : null
  return (
    <div className="flex h-full flex-col">
      <PhoneHeader title="This week" />
      <ul className="flex flex-col gap-2.5 p-4">
        {week.map((row, i) => (
          <li key={row.day} className={clsx('flex items-center gap-3 rounded-2xl bg-surface p-2.5 shadow-card', active && 'chip-pop', row.day === 'Fri' && 'ring-2 ring-butter-yellow')} style={{ ['--d' as string]: `${i * 120}ms` }}>
            <span className="w-9 text-center text-[11px] font-semibold uppercase tracking-wider text-butter-yellow">{row.day}</span>
            <div key={row.pieces.join()} className="fade-swap flex gap-1.5">
              {row.pieces.map((src) => <img key={src} src={src} alt="" loading="lazy" className="h-14 w-11 rounded-lg bg-tile object-contain p-0.5" />)}
            </div>
            <span className="ml-auto pr-1 text-xs text-text-primary">{row.plan}</span>
          </li>
        ))}
      </ul>
      {reaction && (
        <div key={demo.asks} className="chip-pop mx-4 mt-1 flex items-start gap-2.5 rounded-2xl bg-deep-purple p-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-butter-yellow text-xs font-semibold text-dark-purple">{reaction.initials}</span>
          <p className="text-xs leading-relaxed text-text-primary">
            <span className="font-semibold">{reaction.who}</span> {reaction.text}
            <Heart size={12} className="ml-1 inline fill-current text-butter-yellow" />
          </p>
        </div>
      )}
    </div>
  )
}

// ── "Try it" panels that drive the phone ─────────────────────────────────────

function TryCard({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="frame-2 relative w-full max-w-sm rotate-[-1.5deg] p-8">
      <OvalTag className="absolute -right-4 -top-5 rotate-[8deg] text-butter-yellow">try it</OvalTag>
      <p className="font-display text-2xl font-semibold uppercase tracking-wide text-butter-yellow">{title}</p>
      <p className="mt-1 font-display text-base italic text-text-muted">{hint}</p>
      <div className="mt-5">{children}</div>
    </div>
  )
}

function SnapPanel({ demo }: { demo: DemoState }) {
  return (
    <TryCard title="Add a piece" hint="Tap a photo, or drag it onto the phone.">
      <Hint text="drag me onto the phone" hidden={demo.added !== null} arrowFirst rotate={60} className="absolute -bottom-16 -left-24 hidden lg:flex" />
      <div className="grid grid-cols-4 gap-2">
        {ROLL.map((p) => (
          <button
            key={p.id}
            type="button"
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
            onClick={() => demo.setAdded(p)}
            aria-pressed={demo.added?.id === p.id}
            aria-label={`Add ${p.name}`}
            className={clsx(
              'aspect-[3/4] cursor-grab overflow-hidden rounded-xl bg-tile p-1 ring-2 transition-transform hover:-translate-y-1 active:scale-95 active:cursor-grabbing',
              demo.added?.id === p.id ? 'ring-butter-yellow' : 'ring-transparent'
            )}
          >
            <img src={p.image} alt="" draggable={false} className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
      {demo.added && (
        <button type="button" onClick={() => demo.setAdded(null)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary">
          <RotateCcw size={12} /> Reset
        </button>
      )}
    </TryCard>
  )
}

function AskPanel({ demo }: { demo: DemoState }) {
  return (
    <TryCard title="Ask Kaia" hint="Pick a plan and watch her answer from your closet.">
      <div className="flex flex-wrap gap-2">
        {CONVOS.map((c, i) => (
          <button
            key={c.chip}
            type="button"
            onClick={() => demo.setConvo(i)}
            aria-pressed={demo.convo === i}
            className={clsx(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97]',
              demo.convo === i ? 'border-butter-yellow bg-butter-yellow text-dark-purple' : 'border-text-primary/20 text-text-primary hover:border-text-primary/50'
            )}
          >
            {c.chip}
          </button>
        ))}
      </div>
    </TryCard>
  )
}

function ShopPanel({ demo }: { demo: DemoState }) {
  const range = BUDGET[demo.mode]
  const fits = SHOP.filter((i) => (demo.mode === 'buy' ? i.buy : i.rent) <= demo.budget).length
  const switchMode = (m: 'buy' | 'rent') => {
    demo.setMode(m)
    demo.setBudget(m === 'buy' ? 4000 : 700)
  }
  return (
    <TryCard title="Set a budget" hint="Buy it outright or rent it for the week.">
      <div className="flex rounded-full bg-tile p-1 text-sm font-semibold" role="group" aria-label="Buy or rent">
        {(['buy', 'rent'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            aria-pressed={demo.mode === m}
            className={clsx('flex-1 rounded-full py-2 capitalize transition-colors', demo.mode === m ? 'bg-butter-yellow text-dark-purple' : 'text-text-muted hover:text-text-primary')}
          >
            {m}
          </button>
        ))}
      </div>
      <label className="mt-5 block text-sm text-text-primary">
        Up to <span className="font-semibold">{inr.format(demo.budget)}</span>{demo.mode === 'rent' ? ' a week' : ''}
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={demo.budget}
          onChange={(e) => demo.setBudget(Number(e.target.value))}
          className="mt-3 block w-full accent-[rgb(var(--c-butter-yellow))]"
        />
      </label>
      <p className="mt-2 text-xs text-text-muted" aria-live="polite">{fits} of {SHOP.length} pieces fit</p>
    </TryCard>
  )
}

function PlanPanel({ demo }: { demo: DemoState }) {
  return (
    <TryCard title="Plan Friday" hint="Pick a look, then ask your friends.">
      <div className="grid grid-cols-3 gap-2">
        {FRIDAY.map((look, i) => (
          <button
            key={look.label}
            type="button"
            onClick={() => demo.setFriday(i)}
            aria-pressed={demo.friday === i}
            aria-label={look.label}
            className={clsx('flex aspect-[3/4] items-center justify-center gap-0.5 overflow-hidden rounded-xl bg-tile p-1 ring-2 transition-transform hover:-translate-y-1', demo.friday === i ? 'ring-butter-yellow' : 'ring-transparent')}
          >
            {look.pieces.map((src) => <img key={src} src={src} alt="" className="h-full min-w-0 flex-1 object-contain" />)}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => demo.setAsks(demo.asks + 1)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-butter-yellow py-3 text-sm font-semibold text-dark-purple transition-transform active:scale-[0.98]"
      >
        <Send size={15} /> Ask friends
      </button>
    </TryCard>
  )
}

// ── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { icon: Camera, short: 'Snap', title: 'Snap it once. Kloset does the tagging.', body: 'Take a photo or pick one from your gallery. Category, colour, fabric, season and occasion fill themselves in.', Screen: WardrobeScreen, Panel: SnapPanel },
  { icon: MessageCircle, short: 'Ask', title: 'Ask Kaia what to wear.', body: 'Your stylist knows your closet, your style profile and the weather outside, so the answer comes from clothes you own.', Screen: ChatScreen, Panel: AskPanel },
  { icon: ShoppingBag, short: 'Shop', title: 'Shop only what fills a gap.', body: 'Real pieces from Zara, H&M, Myntra and more, picked to work with what you have. Buy it, or rent it by the week.', Screen: ShopScreen, Panel: ShopPanel },
  { icon: CalendarDays, short: 'Plan', title: 'Plan the week, share the look.', body: 'Save outfits, log what you wore, and send a look to friends when you want a second opinion.', Screen: WeekScreen, Panel: PlanPanel },
]

function Phone({ children, className, onDrop }: { children: ReactNode; className?: string; onDrop?: (e: DragEvent) => void }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={onDrop ? (e) => { e.preventDefault(); setOver(true) } : undefined}
      onDragLeave={onDrop ? () => setOver(false) : undefined}
      onDrop={onDrop ? (e) => { e.preventDefault(); setOver(false); onDrop(e) } : undefined}
      className={clsx(
        'relative overflow-hidden rounded-[2.5rem] border-[10px] border-text-primary bg-warm-cream shadow-lifted transition-transform duration-300',
        over && 'scale-[1.03] ring-4 ring-butter-yellow',
        className
      )}
    >
      {children}
    </div>
  )
}

export function FeatureWalkthrough() {
  const [active, setActive] = useState(0)
  const triggers = useRef<(HTMLDivElement | null)[]>([])

  const [added, setAdded] = useState<RollPiece | null>(null)
  const [convo, setConvo] = useState(0)
  const [mode, setMode] = useState<'buy' | 'rent'>('buy')
  const [budget, setBudget] = useState(4000)
  const [friday, setFriday] = useState(0)
  const [asks, setAsks] = useState(0)
  const demo: DemoState = { added, setAdded, convo, setConvo, mode, setMode, budget, setBudget, friday, setFriday, asks, setAsks }

  const dropPiece = (e: DragEvent) => {
    const piece = ROLL.find((p) => p.id === e.dataTransfer.getData('text/plain'))
    if (piece) setAdded(piece)
  }

  // Each step owns one screen of scroll; whichever crosses the middle is active.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step))
      },
      { rootMargin: '-50% 0px -50% 0px' }
    )
    for (const el of triggers.current) if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const jump = (i: number) => triggers.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section id="features" className="relative scroll-mt-20" aria-label="How it works">
      {/* ── Desktop: one pinned stage, scroll steps through it ── */}
      <div className="relative hidden lg:block">
        <div className="sticky top-0 flex h-[100dvh] flex-col overflow-hidden bg-tile px-8 pb-8 pt-24">
          {/* Giant word for the current step, behind everything. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24vw] text-center font-sans text-[27vw] font-extrabold lowercase leading-[0.78] tracking-[-0.06em] text-white" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s.short} className={clsx('absolute inset-x-0 bottom-0 transition-[opacity,transform] duration-700', active === i ? 'opacity-100' : 'translate-y-8 opacity-0')}>
                {s.short}
              </span>
            ))}
          </div>

          <header className="relative mx-auto flex w-full max-w-7xl items-end justify-between gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-butter-yellow">How it works</p>
              <h2 className="mt-3 max-w-[22ch] font-display text-4xl font-medium leading-[1.05] tracking-tight text-text-primary xl:text-5xl">
                From a pile of clothes to a plan for the week.
              </h2>
            </div>
            <div className="w-[min(440px,40%)]">
              <div className="flex justify-between gap-2">
                {STEPS.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.short}
                      type="button"
                      onClick={() => jump(i)}
                      aria-current={active === i ? 'step' : undefined}
                      className={clsx('flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-colors', active === i ? 'bg-butter-yellow text-dark-purple' : 'text-text-primary/60 hover:bg-text-primary/5 hover:text-text-primary')}
                    >
                      <Icon size={15} /> {s.short}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-text-primary/10">
                <div className="h-full origin-left rounded-full bg-butter-yellow transition-transform duration-700 ease-out" style={{ transform: `scaleX(${(active + 1) / STEPS.length})` }} />
              </div>
            </div>
          </header>

          <div className="relative mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-[1fr_auto_1fr] items-center gap-10 pt-6">
            {/* Step copy */}
            <div className="relative z-10 h-72">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                return (
                  <div key={s.short} aria-hidden={active !== i} className={clsx('absolute inset-0 flex flex-col justify-center transition-[opacity,transform] duration-500', active === i ? 'opacity-100' : 'pointer-events-none translate-y-6 opacity-0')}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-butter-yellow text-dark-purple"><Icon size={20} strokeWidth={1.8} /></span>
                    <h3 className="mt-5 max-w-[16ch] font-display text-4xl font-medium leading-[1.1] text-text-primary xl:text-5xl">{s.title}</h3>
                    <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-text-muted">{s.body}</p>
                  </div>
                )
              })}
            </div>

            {/* Phone on a spotlight, with a stitched ring that turns as you scroll */}
            <div className="relative flex h-full items-center justify-center">
              <div className="absolute aspect-square h-[80%] rounded-full bg-deep-purple" aria-hidden="true" />
              <div className="stitch-spin absolute aspect-square h-[92%] rounded-full border-2 border-dashed border-butter-yellow/35" aria-hidden="true" />
              <Phone className="h-[min(600px,calc(100dvh-16rem))] w-[min(340px,calc((100dvh-16rem)*0.57))]" onDrop={dropPiece}>
                {STEPS.map((s, i) => {
                  const Screen = s.Screen
                  const on = active === i
                  return (
                    <div
                      key={s.short}
                      aria-hidden={!on}
                      className={clsx('absolute inset-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]', on ? 'opacity-100' : 'pointer-events-none translate-y-4 opacity-0')}
                    >
                      <Screen active={on} demo={demo} />
                    </div>
                  )
                })}
              </Phone>
            </div>

            {/* Try-it panel */}
            <div className="relative z-10 h-full">
              {STEPS.map((s, i) => {
                const Panel = s.Panel
                const on = active === i
                return (
                  <div
                    key={s.short}
                    aria-hidden={!on}
                    // Hidden panels must not take focus (React 18 types don't know `inert` yet).
                    {...({ inert: on ? undefined : '' } as Record<string, string | undefined>)}
                    className={clsx('absolute inset-0 flex items-center justify-end transition-[opacity,transform] duration-500', on ? 'opacity-100' : 'pointer-events-none translate-x-6 opacity-0')}
                  >
                    <Panel demo={demo} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Scroll triggers: one screen per step, sitting under the pinned stage. */}
        <div className="-mt-[100dvh]" aria-hidden="true">
          {STEPS.map((s, i) => (
            <div key={s.short} ref={(el) => { triggers.current[i] = el }} data-step={i} className="h-[100dvh]" />
          ))}
        </div>
      </div>

      {/* ── Phones and tablets: steps stacked, each with its phone and try-it card ── */}
      <div className="bg-tile px-4 py-24 sm:px-6 lg:hidden">
        <p className="text-xs font-semibold uppercase tracking-widest text-butter-yellow">How it works</p>
        <h2 className="mt-4 font-display text-5xl font-medium leading-[1.05] tracking-tight text-text-primary">From a pile of clothes to a plan for the week.</h2>
        {STEPS.map((s) => {
          const Icon = s.icon
          const Screen = s.Screen
          const Panel = s.Panel
          return (
            <div key={s.short} className="mt-16">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-butter-yellow text-dark-purple"><Icon size={20} strokeWidth={1.8} /></span>
              <h3 className="mt-5 font-display text-4xl font-medium leading-[1.1] text-text-primary">{s.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-text-muted">{s.body}</p>
              <Phone className="mx-auto mt-8 h-[560px] w-full max-w-[340px]" onDrop={dropPiece}>
                <Screen active demo={demo} />
              </Phone>
              <div className="mt-6 flex justify-center"><Panel demo={demo} /></div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
