import { beforeEach, describe, expect, it } from 'vitest'
import { useModalsStore } from '../../src/stores/modals'

describe('modals store', () => {
  beforeEach(() => {
    useModalsStore.setState({
      receiveOpen: false,
      sendInitialStep: 'scan',
      sendOpen: false
    })
  })

  it('opens send with an initial step', () => {
    useModalsStore.getState().openSend('send')
    expect(useModalsStore.getState().sendOpen).toBeTruthy()
    expect(useModalsStore.getState().sendInitialStep).toBe('send')
  })

  it('opens receive', () => {
    useModalsStore.getState().openReceive()
    expect(useModalsStore.getState().receiveOpen).toBeTruthy()
  })

  it('closes send via setSendOpen', () => {
    useModalsStore.setState({ sendOpen: true })
    useModalsStore.getState().setSendOpen(false)
    expect(useModalsStore.getState().sendOpen).toBeFalsy()
  })

  it('closes receive via setReceiveOpen', () => {
    useModalsStore.setState({ receiveOpen: true })
    useModalsStore.getState().setReceiveOpen(false)
    expect(useModalsStore.getState().receiveOpen).toBeFalsy()
  })
})
