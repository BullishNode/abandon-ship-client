import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth'

describe(useAuthStore, () => {
  beforeEach(() => {
    useAuthStore.setState({ authRequired: false, authed: true, deviceUnlockFailed: false })
  })

  it('stores deviceUnlockFailed when provided', () => {
    useAuthStore
      .getState()
      .setStatus({ authRequired: true, authed: false, deviceUnlockFailed: true })
    expect(useAuthStore.getState().deviceUnlockFailed).toBeTruthy()
  })

  it('resets a stale deviceUnlockFailed when the next status omits it', () => {
    useAuthStore
      .getState()
      .setStatus({ authRequired: true, authed: false, deviceUnlockFailed: true })
    useAuthStore.getState().setStatus({ authRequired: true, authed: true })
    expect(useAuthStore.getState().deviceUnlockFailed).toBeFalsy()
  })

  it('records whether a required token was a rejected one', () => {
    useAuthStore.getState().requireToken(true)
    expect(useAuthStore.getState()).toMatchObject({ tokenRejected: true, tokenRequired: true })
    useAuthStore.getState().requireToken(false)
    expect(useAuthStore.getState()).toMatchObject({ tokenRejected: false, tokenRequired: true })
  })
})
