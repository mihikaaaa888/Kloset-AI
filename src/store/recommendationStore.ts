import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RecommendationFeedback } from '@/lib/recommendationFeedback'
import { clearVotes, feedbackKey, saveFeedback } from '@/lib/feedbackService'

// Signed-in users have a Supabase id; 'guest' and other local ids stay local.
const isAccountId = (userId: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)

interface RecommendationStore {
  feedbackByUser: Record<string, RecommendationFeedback[]>
  recordFeedback: (userId: string, feedback: RecommendationFeedback) => void
  recordFeedbackBatch: (userId: string, feedback: RecommendationFeedback[]) => void
  clearSwipeFeedback: (userId: string) => void
  /** Merge ratings saved on the account (other devices) into this browser's copy. */
  mergeRemoteFeedback: (userId: string, remote: RecommendationFeedback[]) => void
}

function appendFeedback(current: RecommendationFeedback[], incoming: RecommendationFeedback[]): RecommendationFeedback[] {
  let next = current
  for (const feedback of incoming) {
    const sameDayDwell = feedback.action === 'dwell'
      ? next.filter((event) => !(event.action === 'dwell' && event.itemId === feedback.itemId && event.createdAt.slice(0, 10) === feedback.createdAt.slice(0, 10)))
      : next
    const withoutOldVote = feedback.action === 'like' || feedback.action === 'dislike'
      ? sameDayDwell.filter((event) => !(event.itemId === feedback.itemId && (event.action === 'like' || event.action === 'dislike')))
      : sameDayDwell
    next = [...withoutOldVote, feedback]
  }
  return next.slice(-800)
}

export const useRecommendationStore = create<RecommendationStore>()(
  persist(
    (set, get) => ({
      feedbackByUser: {},
      recordFeedback: (userId, feedback) => {
        set((state) => ({
          feedbackByUser: { ...state.feedbackByUser, [userId]: appendFeedback(state.feedbackByUser[userId] ?? [], [feedback]) },
        }))
        if (isAccountId(userId)) void saveFeedback(userId, [feedback])
      },
      recordFeedbackBatch: (userId, feedback) => {
        set((state) => ({
          feedbackByUser: { ...state.feedbackByUser, [userId]: appendFeedback(state.feedbackByUser[userId] ?? [], feedback) },
        }))
        if (isAccountId(userId)) void saveFeedback(userId, feedback)
      },
      clearSwipeFeedback: (userId) => {
        set((state) => ({
          feedbackByUser: {
            ...state.feedbackByUser,
            [userId]: (state.feedbackByUser[userId] ?? []).filter((event) => event.action === 'dwell'),
          },
        }))
        if (isAccountId(userId)) void clearVotes(userId)
      },
      mergeRemoteFeedback: (userId, remote) => {
        const local = get().feedbackByUser[userId] ?? []
        // Newest event wins per key, from either side.
        const byKey = new Map<string, RecommendationFeedback>()
        for (const event of [...remote, ...local]) {
          const key = feedbackKey(event)
          const existing = byKey.get(key)
          if (!existing || existing.createdAt <= event.createdAt) byKey.set(key, event)
        }
        const merged = [...byKey.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-800)
        set((state) => ({ feedbackByUser: { ...state.feedbackByUser, [userId]: merged } }))
        // Ratings given before this sync existed (or offline) only live here: send them up.
        const remoteKeys = new Map(remote.map((event) => [feedbackKey(event), event.createdAt]))
        const missing = merged.filter((event) => (remoteKeys.get(feedbackKey(event)) ?? '') < event.createdAt)
        if (missing.length && isAccountId(userId)) void saveFeedback(userId, missing)
      },
    }),
    {
      name: 'kloset-recommendation-feedback',
      partialize: (state) => ({ feedbackByUser: state.feedbackByUser }),
    },
  ),
)
