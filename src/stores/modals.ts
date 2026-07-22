import { create } from 'zustand'

type SendStep = 'scan' | 'send'

interface ModalsStore {
  sendOpen: boolean
  sendInitialStep: SendStep
  receiveOpen: boolean
  boardOpen: boolean
  openSend: (step: SendStep) => void
  setSendOpen: (open: boolean) => void
  openReceive: () => void
  setReceiveOpen: (open: boolean) => void
  openBoard: () => void
  setBoardOpen: (open: boolean) => void
}

export const useModalsStore = create<ModalsStore>((set) => ({
  boardOpen: false,
  openBoard: () => {
    set({ boardOpen: true })
  },
  openReceive: () => {
    set({ receiveOpen: true })
  },
  openSend: (step) => {
    set({ sendInitialStep: step, sendOpen: true })
  },
  receiveOpen: false,
  sendInitialStep: 'scan',
  sendOpen: false,
  setBoardOpen: (boardOpen) => {
    set({ boardOpen })
  },
  setReceiveOpen: (receiveOpen) => {
    set({ receiveOpen })
  },
  setSendOpen: (sendOpen) => {
    set({ sendOpen })
  }
}))
