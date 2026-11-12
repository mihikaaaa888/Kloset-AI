import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RecommendationFeedback } from '@/lib/recommendationFeedback'

interface RecommendationStore {
  feedbackByUser: Record<string, RecommendationFeedback[]>
  recordFeedback: (userId: string, feedback: RecommendationFeedback) => void
  recordFeedbackBatch: (userId: string, feedback: RecommendationFeedback[]) => void
  clearSwipeFeedback: (userId: string) => void
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
    (set) => ({
      feedbackByUser: {},
      recordFeedback: (userId, feedback) => set((state) => ({
        feedbackByUser: { ...state.feedbackByUser, [userId]: appendFeedback(state.feedbackByUser[userId] ?? [], [feedback]) },
      })),
      recordFeedbackBatch: (userId, feedback) => set((state) => ({
        feedbackByUser: { ...state.feedbackByUser, [userId]: appendFeedback(state.feedbackByUser[userId] ?? [], feedback) },
      })),
      clearSwipeFeedback: (userId) => set((state) => ({
        feedbackByUser: {
          ...state.feedbackByUser,
          [userId]: (state.feedbackByUser[userId] ?? []).filter((event) => event.action === 'dwell'),
        },
      })),
    }),
    {
      name: 'kloset-recommendation-feedback',
      partialize: (state) => ({ feedbackByUser: state.feedbackByUser }),
    },
  ),
)
