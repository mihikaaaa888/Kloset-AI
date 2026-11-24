import { supabase } from './supabase'
import type { RecommendationFeedback } from '@/lib/recommendationFeedback'

// Thumbs up / down and views are stored per account (supabase/recommendation_feedback.sql)
// so they shape recommendations on every device, not just the browser they were
// given in. The local store stays the working copy; this keeps the server in step.

/** One row per vote target, or per item per day for views — mirrors appendFeedback. */
export function feedbackKey(event: RecommendationFeedback): string {
  return event.action === 'dwell'
    ? `dwell:${event.itemId}:${event.createdAt.slice(0, 10)}`
    : event.itemId
}

export async function fetchFeedback(userId: string): Promise<RecommendationFeedback[] | null> {
  const { data, error } = await supabase
    .from('recommendation_feedback')
    .select('payload')
    .eq('user_id', userId)
    // Newest first so a long history keeps its recent votes (the store keeps the last 800).
    .order('created_at', { ascending: false })
    .limit(800)
  if (error) {
    // Most likely the table hasn't been created yet; keep working from local data.
    console.warn('[feedback] could not load saved ratings:', error.message)
    return null
  }
  return (data ?? []).map((row) => row.payload as RecommendationFeedback).reverse()
}

export async function saveFeedback(userId: string, events: RecommendationFeedback[]): Promise<void> {
  if (!events.length) return
  // The same key can appear twice in one batch (e.g. a vote then a changed
  // vote); keep the last, as the local store does.
  const rows = [...new Map(events.map((event) => [feedbackKey(event), {
    user_id: userId,
    key: feedbackKey(event),
    action: event.action,
    payload: event,
    created_at: event.createdAt,
  }])).values()]
  const { error } = await supabase.from('recommendation_feedback').upsert(rows, { onConflict: 'user_id,key' })
  if (error) console.warn('[feedback] could not save ratings:', error.message)
}

/** "Start over" on For You clears votes but keeps views. */
export async function clearVotes(userId: string): Promise<void> {
  const { error } = await supabase
    .from('recommendation_feedback')
    .delete()
    .eq('user_id', userId)
    .in('action', ['like', 'dislike'])
  if (error) console.warn('[feedback] could not clear ratings:', error.message)
}
