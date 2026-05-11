import { create } from 'zustand'

type SendStep = 'scan' | 'send'

interface ModalsStore {
  sendOpen: boolean
  sendInitialStep: SendStep
  receiveOpen: boolean
  openSend: (step: SendStep) => void
  setSendOpen: (open: boolean) => void
  openReceive: () => void
  setReceiveOpen: (open: boolean) => void
}

export const useModalsStore = create<ModalsStore>((set) => ({
  openReceive: () => {
    set({ receiveOpen: true })
  },
  openSend: (step) => {
    set({ sendInitialStep: step, sendOpen: true })
  },
  receiveOpen: false,
  sendInitialStep: 'scan',
  sendOpen: false,
  setReceiveOpen: (receiveOpen) => {
    set({ receiveOpen })
  },
  setSendOpen: (sendOpen) => {
    set({ sendOpen })
  }
}))
