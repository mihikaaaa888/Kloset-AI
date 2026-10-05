import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, RotateCcw, Plus, Check, ExternalLink } from 'lucide-react'
import { HangerIcon } from '@/components/ui/HangerIcon'
import { clsx } from 'clsx'
import { sendChatMessage, type ChatMessage } from '@/lib/chatService'
import { searchWebShop, cleanProductTitle, type Retailer } from '@/lib/webShopService'
import { useWardrobeStore } from '@/store/wardrobeStore'
import { useUserStore } from '@/store/userStore'
import { useChatStore } from '@/store/chatStore'
import { useAuth } from '@/contexts/AuthContext'
import { insertItem } from '@/lib/wardrobeService'
import { CATALOG_ITEMS } from '@/lib/catalogData'
import type { CatalogItem, ClothingItem, WebShopResult } from '@/types'

const SUGGESTED_PROMPTS = [
  'What should I wear today?',
  'Style my wardrobe for a date night.',
  'Give me 3 outfits using my wardrobe.',
  'What goes with my favourite pieces?',
  'I need something for a formal event.',
]

// Kaia is grounded on a sample of the catalog (see chatService's shopSummary)
// and will name real pieces by their exact catalog name — matching on that
// name lets the chat surface an "Add to Kloset" action for anything she
// suggests, instead of leaving the user to go find it on Discover themselves.
function findMentionedCatalogItems(content: string): CatalogItem[] {
  const lower = content.toLowerCase()
  return CATALOG_ITEMS.filter((item) => lower.includes(item.name.toLowerCase()))
}

// Kaia is instructed (see server's system prompt) to end a genuine external
// brand recommendation with [[SHOP: <slot> | <query>]] — a machine-readable
// tag, not meant to be shown. We strip it from the displayed text and use the
// query to run a live Exa search, so the recommendation resolves to a real,
// current product link instead of a name she can't verify. The slot is for
// the server's outfit check; older messages without one still parse.
const SHOP_TAG_RE = /\[\[SHOP:\s*(?:[a-z]+\s*\|\s*)?([^\]]+)\]\]/gi

const RETAILERS: Retailer[] = ['zara', 'hm', 'cos', 'uniqlo', 'mango', 'stories', 'everlane']

interface ShopQuery {
  query: string
  retailer: Retailer | null
}

// A tag can end with a store the user asked for: [[SHOP: dress | black slip dress | zara]].
// A list of options carries one tag per piece, so every tag is stripped and searched.
function extractShopQueries(content: string): { text: string; queries: ShopQuery[] } {
  const queries: ShopQuery[] = []
  for (const match of content.matchAll(SHOP_TAG_RE)) {
    const [query, store] = match[1].split('|').map((part) => part.trim())
    if (!query || queries.some((q) => q.query === query)) continue
    queries.push({ query, retailer: RETAILERS.find((r) => r === store?.toLowerCase()) ?? null })
  }
  const text = content.replace(SHOP_TAG_RE, '').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
  return { text, queries: queries.slice(0, 4) }
}

export function StylistChat({ initialPrompt }: { initialPrompt?: string }) {
  const items = useWardrobeStore((s) => s.items)
  const addItem = useWardrobeStore((s) => s.addItem)
  const profile = useUserStore((s) => s.profile)
  const { user } = useAuth()
  const navigate = useNavigate()

  const messages = useChatStore((s) => s.messages)
  const setMessages = useChatStore((s) => s.setMessages)
  const clearChat = useChatStore((s) => s.clear)

  const [input, setInput] = useState(initialPrompt ?? '')
  const [loading, setLoading] = useState(false)
  const [addedCatalogIds, setAddedCatalogIds] = useState<Set<string>>(
    () => new Set(items.map((i) => i.catalogId).filter(Boolean) as string[])
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt)
      inputRef.current?.focus()
    }
  }, [initialPrompt])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const reply = await sendChatMessage(next, items, profile)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      console.error('[chat] send failed', e)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: navigator.onLine
          ? "I couldn't reach the styling service just now — please try again in a moment."
          : "You seem to be offline. Check your connection and try again.",
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const reset = () => {
    clearChat()
    setInput('')
  }

  const handleAddCatalogItem = (catalogItem: CatalogItem) => {
    const now = new Date().toISOString()
    const newItem: ClothingItem = {
      id: crypto.randomUUID(),
      name: catalogItem.name,
      category: catalogItem.category,
      subcategory: catalogItem.subcategory,
      imageUrl: catalogItem.imageUrl,
      imageSource: 'remote',
      colour: catalogItem.colours,
      material: catalogItem.material,
      pattern: catalogItem.pattern,
      fit: catalogItem.fit,
      formality: catalogItem.formality,
      seasons: catalogItem.seasons,
      occasions: catalogItem.occasions,
      isFavourite: false,
      timesWorn: 0,
      createdAt: now,
      updatedAt: now,
      catalogId: catalogItem.id,
    }
    addItem(newItem)
    setAddedCatalogIds((prev) => new Set(prev).add(catalogItem.id))
    if (user) insertItem(user.id, newItem).catch(() => {})
  }

  const isEmpty = messages.length === 0
  const hasAddedFromChat = addedCatalogIds.size > 0

  return (
    <div className="flex flex-col h-full min-h-[60vh]">

      {/* ── Message list or empty state ── */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {isEmpty ? (
          <EmptyState onPrompt={(p) => send(p)} />
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                addedCatalogIds={addedCatalogIds}
                onAddCatalogItem={handleAddCatalogItem}
              />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Input ── */}
      {/* Pinned above the phone tab bar (56px + home-indicator inset) so the message box is always in reach. */}
      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0 z-10 -mx-4 px-4 pt-4 pb-3 md:pb-0 bg-warm-cream border-t border-text-primary/8">
        {hasAddedFromChat && (
          <button
            onClick={() => navigate('/wardrobe')}
            className="w-full flex items-center justify-center gap-2 mb-3 py-2.5 rounded-2xl bg-butter-yellow text-dark-purple text-sm font-medium hover:bg-soft-butter transition-colors"
          >
            <Check size={14} />
            Build My Kloset from added items
          </button>
        )}
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary mb-3 transition-colors"
          >
            <RotateCcw size={11} />
            New conversation
          </button>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Kaia anything…"
            rows={1}
            maxLength={4000}
            className="flex-1 resize-none px-4 py-3 rounded-2xl border border-text-primary/15 bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary/40 transition-colors leading-relaxed"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className={clsx(
              'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 flex-shrink-0',
              input.trim() && !loading
                ? 'bg-dark-purple text-butter-yellow hover:bg-deep-purple'
                : 'bg-text-primary/10 text-text-primary/30 cursor-not-allowed'
            )}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-2xs text-text-muted mt-2">
          Kaia has access to your wardrobe and style preferences.
        </p>
      </div>
    </div>
  )
}

// Kaia's replies come back with markdown-style **bold** markers and,
// occasionally, a full markdown table (e.g. comparing outfit pieces) — this
// renders both as real formatting instead of showing literal asterisks/pipes.
function formatInline(text: string) {
  // Cell content may use <br> for a line break within a single table cell.
  return text.split(/<br\s*\/?>/gi).map((line, li) => (
    <span key={li}>
      {li > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  ))
}

type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'hr' }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const HEADING_RE = /^(#{1,6})\s+(.+)$/
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const UL_ITEM_RE = /^\s*[-*+]\s+(.+)$/
const OL_ITEM_RE = /^\s*\d+[.)]\s+(.+)$/

function splitTableRow(line: string): string[] {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.map((c) => c.trim())
}

// Splits a chat message into block-level markdown segments (headings, rules,
// lists, tables, plain text) so each renders with the markup it actually
// needs — a <table> or <h3> can't live inside a whitespace-pre-wrap text node.
function parseMessageBlocks(content: string): ContentBlock[] {
  const lines = content.split('\n')
  const blocks: ContentBlock[] = []
  let buffer: string[] = []

  const flushText = () => {
    const text = buffer.join('\n').trim()
    if (text) blocks.push({ type: 'text', content: text })
    buffer = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (TABLE_ROW_RE.test(line) && i + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[i + 1])) {
      flushText()
      const headers = splitTableRow(line)
      const rows: string[][] = []
      let j = i + 2
      while (j < lines.length && TABLE_ROW_RE.test(lines[j])) {
        rows.push(splitTableRow(lines[j]))
        j++
      }
      blocks.push({ type: 'table', headers, rows })
      i = j
      continue
    }

    const headingMatch = line.match(HEADING_RE)
    if (headingMatch) {
      flushText()
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2].trim() })
      i++
      continue
    }

    if (line.trim() !== '' && HR_RE.test(line)) {
      flushText()
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    const ulMatch = line.match(UL_ITEM_RE)
    const olMatch = line.match(OL_ITEM_RE)
    if (ulMatch || olMatch) {
      flushText()
      const ordered = !!olMatch
      const itemRe = ordered ? OL_ITEM_RE : UL_ITEM_RE
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(itemRe)
        if (!m) break
        items.push(m[1].trim())
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    buffer.push(line)
    i++
  }
  flushText()
  return blocks
}

function MessageContent({ text }: { text: string }) {
  const blocks = parseMessageBlocks(text)
  return (
    <>
      {blocks.map((block, i) =>
        block.type === 'heading' ? (
          <p
            key={i}
            className={clsx(
              'font-semibold',
              block.level <= 2 ? 'text-base' : 'text-sm'
            )}
          >
            {formatInline(block.content)}
          </p>
        ) : block.type === 'hr' ? (
          <hr key={i} className="my-1 border-t border-text-primary/10" />
        ) : block.type === 'list' ? (
          block.ordered ? (
            <ol key={i} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, ii) => (
                <li key={ii}>{formatInline(item)}</li>
              ))}
            </ol>
          ) : (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {block.items.map((item, ii) => (
                <li key={ii}>{formatInline(item)}</li>
              ))}
            </ul>
          )
        ) : block.type === 'table' ? (
          <div key={i} className="my-2 overflow-x-auto rounded-xl border border-text-primary/10">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-text-primary/5">
                  {block.headers.map((h, hi) => (
                    <th
                      key={hi}
                      className="px-3 py-2 font-semibold text-text-primary whitespace-nowrap border-b border-text-primary/10"
                    >
                      {formatInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-text-primary/[0.02]' : ''}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 align-top border-b border-text-primary/5 last:border-0">
                        {formatInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {formatInline(block.content)}
          </p>
        )
      )}
    </>
  )
}

function MessageBubble({
  message,
  addedCatalogIds,
  onAddCatalogItem,
}: {
  message: ChatMessage
  addedCatalogIds: Set<string>
  onAddCatalogItem: (item: CatalogItem) => void
}) {
  const isUser = message.role === 'user'
  const { text, queries: shopQueries } = isUser
    ? { text: message.content, queries: [] as ShopQuery[] }
    : extractShopQueries(message.content)
  const mentioned = isUser ? [] : findMentionedCatalogItems(text)

  return (
    <div className={clsx('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div className="flex w-full" style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-dark-purple flex items-center justify-center flex-shrink-0 mt-0.5 mr-2.5">
            <HangerIcon size={13} className="text-butter-yellow" />
          </div>
        )}
        <div
          className={clsx(
            'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed space-y-1',
            isUser
              ? 'bg-dark-purple text-text-primary rounded-br-md'
              : 'bg-white text-text-primary shadow-card rounded-bl-md'
          )}
        >
          <MessageContent text={text} />
        </div>
      </div>

      {shopQueries.map((q) => (
        <ExternalShopSuggestion
          key={q.query}
          query={q.query}
          retailer={q.retailer}
          // One store, one piece → show more of that store's options.
          limit={shopQueries.length === 1 && q.retailer ? 6 : 3}
        />
      ))}

      {/* Real catalog pieces Kaia named — add them to the Kloset directly, or shop/rent, without leaving the chat. */}
      {mentioned.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 ml-9 max-w-[80%]">
          {mentioned.map((item) => {
            const added = addedCatalogIds.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => !added && onAddCatalogItem(item)}
                disabled={added}
                className={clsx(
                  'flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  added
                    ? 'bg-text-primary/5 border-text-primary/10 text-text-primary/40 cursor-default'
                    : 'bg-white border-text-primary/15 text-text-primary hover:border-butter-yellow hover:bg-butter-yellow/5'
                )}
              >
                <img src={item.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                {added ? <Check size={12} /> : <Plus size={12} />}
                {item.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Resolves a [[SHOP: ...]] tag into real product links via the Exa-backed
// search (see src/lib/webShopService.ts). Fails silently — no key, no
// results, or an upstream error all just mean no card renders, rather than
// cluttering the chat with an error state for what's a bonus, not the reply.
// Brand names are never shown — just the piece and a link.
function ExternalShopSuggestion({ query, retailer, limit }: { query: string; retailer: Retailer | null; limit: number }) {
  const [status, setStatus] = useState<'loading' | 'done' | 'none'>('loading')
  const [results, setResults] = useState<WebShopResult[]>([])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    searchWebShop(query, retailer ? [retailer] : undefined)
      .then(({ results: found, noKey, error }) => {
        if (cancelled) return
        if (noKey || error || !found.length) {
          setStatus('none')
          return
        }
        setResults(found.slice(0, limit))
        setStatus('done')
      })
      .catch(() => {
        if (!cancelled) setStatus('none')
      })
    return () => {
      cancelled = true
    }
  }, [query, retailer, limit])

  if (status === 'none') return null

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 mt-2 ml-9 text-2xs text-text-muted">
        <div className="w-3 h-3 border-2 border-text-primary/15 border-t-dark-purple rounded-full animate-spin" />
        Finding pieces for &ldquo;{query}&rdquo;…
      </div>
    )
  }

  return (
    <div className="flex gap-2 mt-2 ml-9 max-w-[80%] overflow-x-auto scrollbar-hide">
      {results.map((r) => (
        <a
          key={r.id}
          href={r.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-medium border border-text-primary/15 bg-white text-text-primary hover:border-butter-yellow hover:bg-butter-yellow/5 transition-colors whitespace-nowrap flex-shrink-0"
        >
          {r.imageUrl ? (
            <img src={r.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
          ) : (
            <ExternalLink size={12} className="flex-shrink-0" />
          )}
          {cleanProductTitle(r.title)}
        </a>
      ))}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-dark-purple flex items-center justify-center flex-shrink-0">
        <HangerIcon size={13} className="text-butter-yellow" />
      </div>
      <div className="bg-white shadow-card px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-text-primary/40 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-full bg-dark-purple flex items-center justify-center mb-4">
        <HangerIcon size={22} className="text-butter-yellow" />
      </div>
      <h3 className="font-display text-xl font-medium text-text-primary mb-1">Meet Kaia</h3>
      <p className="text-text-muted text-sm text-center max-w-xs mb-8">
        Your personal AI stylist. Ask anything about what to wear, how to style your pieces, or what to add to your wardrobe.
      </p>
      <div className="w-full space-y-2">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPrompt(p)}
            className="w-full text-left px-4 py-3 rounded-2xl bg-white border border-text-primary/10 text-sm text-text-primary hover:border-text-primary/30 hover:bg-text-primary/3 transition-all duration-200"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
