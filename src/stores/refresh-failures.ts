import { create } from 'zustand'

interface RefreshFailuresStore {
  refusedAtHeight: Record<string, number>
  addRefusedVtxoIds: (ids: string[], height: number | undefined) => void
}

export function getRefusedVtxoIds(refusals: Record<string, number>, tip?: number): string[] {
  return Object.keys(refusals).filter((id) => tip === undefined || refusals[id] >= tip)
}

export const useRefreshFailuresStore = create<RefreshFailuresStore>((set) => ({
  addRefusedVtxoIds: (ids, height) => {
    if (height === undefined || ids.length === 0) {
      return
    }
    set((state) => {
      if (ids.every((id) => state.refusedAtHeight[id] === height)) {
        return state
      }
      return {
        refusedAtHeight: {
          ...state.refusedAtHeight,
          ...Object.fromEntries(ids.map((id) => [id, height]))
        }
      }
    })
  },
  refusedAtHeight: {}
}))
