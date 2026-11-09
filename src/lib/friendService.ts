import { supabase } from './supabase'
import { getImage } from './imageStorage'
import type { ClothingItem, Connection, Outfit, Share, SharedPiece, SharePayload } from '@/types'

// Backed by supabase/friends.sql — friend_requests, shares, and the
// shared-images storage bucket.

const BUCKET = 'shared-images'

// Fired after friend/share changes so the nav badge refreshes right away.
export const FRIENDS_CHANGED_EVENT = 'kloset:friends-changed'

/** Turns a Supabase error into a thrown Error with a readable message, and logs it. */
function fail(context: string, error: { message: string; code?: string } | null): never {
  console.error(`[friends] ${context} failed`, error)
  // 42P01 / PGRST202: table or function missing → the migration hasn't been run
  if (error?.code === '42P01' || error?.code === 'PGRST202' || error?.code === 'PGRST205') {
    throw new Error('Friends isn’t set up on the database yet. Run supabase/friends.sql in the Supabase SQL Editor.')
  }
  throw new Error(error?.message ?? `${context} failed`)
}

// ─── Connections ──────────────────────────────────────────────────────────────

type DbConnection = {
  id: string
  status: Connection['status']
  direction: Connection['direction']
  other_id: string
  other_name: string
  other_email: string
  created_at: string
  responded_at: string | null
}

export async function listConnections(): Promise<Connection[]> {
  const { data, error } = await supabase.rpc('list_connections')
  if (error) fail('list connections', error)
  return (data as DbConnection[]).map((r) => ({
    id: r.id,
    status: r.status,
    direction: r.direction,
    otherId: r.other_id,
    otherName: r.other_name || r.other_email?.split('@')[0] || 'Kloset member',
    otherEmail: r.other_email,
    createdAt: r.created_at,
    respondedAt: r.responded_at,
  }))
}

/**
 * Sends a friend request by email. Handles the awkward cases: they already
 * asked you (accepts it), you're already friends, a pending request exists,
 * or an earlier request was declined (clears it and asks again).
 */
export async function sendFriendRequest(email: string, myId: string): Promise<'sent' | 'accepted'> {
  const { data: found, error: findError } = await supabase.rpc('find_user_by_email', { p_email: email })
  if (findError) fail('find user', findError)
  const target = (found as { id: string; name: string }[] | null)?.[0]
  if (!target) throw new Error('No Kloset account uses that email. Check the spelling, or ask them to sign up first.')

  const existing = (await listConnections()).find((c) => c.otherId === target.id)
  if (existing?.status === 'accepted') throw new Error('You’re already friends.')
  if (existing?.status === 'pending' && existing.direction === 'outgoing') throw new Error('Request already sent. Waiting for them to accept.')
  if (existing?.status === 'pending' && existing.direction === 'incoming') {
    await respondToRequest(existing.id, true)
    return 'accepted'
  }
  if (existing?.status === 'declined') await removeConnection(existing.id)

  const { error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: myId, recipient_id: target.id })
  if (error) fail('send friend request', error)
  console.log('[friends] request sent', { to: target.id })
  return 'sent'
}

export async function respondToRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) fail('respond to request', error)
  console.log('[friends] request answered', { requestId, accept })
}

/** Cancels an outgoing request, or unfriends. */
export async function removeConnection(requestId: string): Promise<void> {
  const { error } = await supabase.from('friend_requests').delete().eq('id', requestId)
  if (error) fail('remove connection', error)
  console.log('[friends] connection removed', requestId)
}

export interface FriendMessage {
  id: string
  senderId: string
  recipientId: string
  body: string
  createdAt: string
}

export async function listFriendMessages(friendId: string, myId: string): Promise<FriendMessage[]> {
  // The ids go into a PostgREST filter string, so they must be plain UUIDs.
  if (![friendId, myId].every((id) => /^[0-9a-f-]{36}$/i.test(id))) throw new Error('Invalid user id')
  const { data, error } = await supabase.from('friend_messages').select('id,sender_id,recipient_id,body,created_at')
    .or(`and(sender_id.eq.${myId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${myId})`)
    .order('created_at', { ascending: true })
  if (error) fail('load messages', error)
  return ((data ?? []) as { id: string; sender_id: string; recipient_id: string; body: string; created_at: string }[]).map((row) => ({ id: row.id, senderId: row.sender_id, recipientId: row.recipient_id, body: row.body, createdAt: row.created_at }))
}

export async function sendFriendMessage(friendId: string, myId: string, body: string): Promise<void> {
  const { error } = await supabase.from('friend_messages').insert({ sender_id: myId, recipient_id: friendId, body: body.trim() })
  if (error) fail('send message', error)
}

// ─── Sharing ──────────────────────────────────────────────────────────────────

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/**
 * Copies a piece's photo into shared storage so friends can see it — local
 * photos otherwise only exist in this browser's IndexedDB.
 */
async function snapshotPiece(
  item: ClothingItem,
  myId: string,
  bundleId: string,
  role?: SharedPiece['role']
): Promise<SharedPiece> {
  const piece: SharedPiece = {
    name: item.name,
    category: item.category,
    colour: item.colour,
    material: item.material,
    pattern: item.pattern,
    brand: item.brand,
    notes: item.notes,
    role,
  }

  if (item.imageUrl && /^https?:/.test(item.imageUrl)) {
    piece.imageUrl = item.imageUrl
    return piece
  }

  let blob: Blob | null = null
  if (item.imageUrl?.startsWith('data:')) blob = await dataUrlToBlob(item.imageUrl)
  else if (item.imageId) blob = await getImage(item.imageId)
  if (!blob) return piece

  const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const path = `${myId}/${bundleId}/${item.id}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true })
  if (error) {
    // Still send the piece — the friend just sees the placeholder instead of the photo.
    console.error('[friends] photo upload failed, sending without photo', { itemId: item.id, error })
    return piece
  }
  piece.imagePath = path
  return piece
}

export type ShareTarget =
  | { kind: 'item'; item: ClothingItem }
  | { kind: 'outfit'; outfit: Outfit; items: ClothingItem[] }

export async function sendShare(
  target: ShareTarget,
  recipientIds: string[],
  myId: string,
  message: string
): Promise<string[]> {
  if (recipientIds.length === 0) return []
  const bundleId = crypto.randomUUID()

  let payload: SharePayload
  if (target.kind === 'item') {
    payload = { title: target.item.name, pieces: [await snapshotPiece(target.item, myId, bundleId)] }
  } else {
    const byId = new Map(target.items.map((i) => [i.id, i]))
    const pieces = await Promise.all(
      target.outfit.items
        .map((oi) => ({ oi, item: byId.get(oi.itemId) }))
        .filter((x): x is { oi: typeof x.oi; item: ClothingItem } => !!x.item)
        .map(({ oi, item }) => snapshotPiece(item, myId, bundleId, oi.role))
    )
    payload = { title: target.outfit.name, occasion: target.outfit.occasion, pieces }
  }

  const shareIds = recipientIds.map(() => crypto.randomUUID())
  const rows = recipientIds.map((recipient_id, index) => ({
    id: shareIds[index],
    sender_id: myId,
    recipient_id,
    bundle_id: bundleId,
    kind: target.kind,
    payload,
    message: message.trim() || null,
  }))
  const { error } = await supabase.from('shares').insert(rows)
  if (error) fail('send share', error)
  console.log('[friends] shared', { kind: target.kind, recipients: recipientIds.length, pieces: payload.pieces.length })
  return shareIds
}

type DbShare = {
  id: string
  kind: Share['kind']
  payload: SharePayload
  message: string | null
  created_at: string
  seen_at: string | null
  direction: Share['direction']
  other_id: string
  other_name: string
}

export async function listShares(): Promise<Share[]> {
  const { data, error } = await supabase.rpc('list_shares')
  if (error) fail('list shares', error)
  return (data as DbShare[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: r.payload,
    message: r.message,
    createdAt: r.created_at,
    seenAt: r.seen_at,
    direction: r.direction,
    otherId: r.other_id,
    otherName: r.other_name || 'A friend',
  }))
}

export async function markSharesSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('shares').update({ seen_at: new Date().toISOString() }).in('id', ids)
  if (error) fail('mark shares seen', error)
  console.log('[friends] marked seen', ids.length)
}

export async function deleteShare(id: string): Promise<void> {
  const { error } = await supabase.from('shares').delete().eq('id', id)
  if (error) fail('delete share', error)
  console.log('[friends] share removed', id)
}

/** Signed URLs for shared photos, valid for an hour. */
export async function resolveSharedImages(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  if (unique.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600)
  if (error) {
    console.error('[friends] signing photo urls failed', error)
    return {}
  }
  const out: Record<string, string> = {}
  for (const d of data) if (d.signedUrl && d.path) out[d.path] = d.signedUrl
  return out
}

/** Pending incoming requests + unseen received shares — drives the nav badge. */
export async function countFriendActivity(): Promise<number> {
  const [conns, shares] = await Promise.all([listConnections(), listShares()])
  return (
    conns.filter((c) => c.status === 'pending' && c.direction === 'incoming').length +
    shares.filter((s) => s.direction === 'received' && !s.seenAt).length
  )
}
