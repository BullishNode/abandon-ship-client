import { create } from 'zustand'

// Coins the Ark server refused in a refresh. Kept for the session only: a ban
// lapses, and a reload retries them once.
interface RefreshFailuresStore {
  refusedVtxoIds: string[]
  addRefusedVtxoIds: (ids: string[]) => void
}

export const useRefreshFailuresStore = create<RefreshFailuresStore>((set) => ({
  addRefusedVtxoIds: (ids) => {
    set((state) => {
      const added = ids.filter((id) => !state.refusedVtxoIds.includes(id))
      return added.length === 0 ? state : { refusedVtxoIds: [...state.refusedVtxoIds, ...added] }
    })
  },
  refusedVtxoIds: []
}))
