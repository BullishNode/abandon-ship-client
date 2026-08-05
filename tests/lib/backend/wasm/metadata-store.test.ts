import { beforeEach, describe, expect, it } from 'vitest'
import { BARK_WEB_METADATA_KEY } from '@/constants/metadata'
import { getMovementMetadata, setMovementMetadata } from '@/lib/backend/wasm/metadata-store'
import { useWalletStore } from '@/stores/wallet'

function setFingerprint(fingerprint: string): void {
  useWalletStore.setState({ wallet: { createdAt: '', fingerprint, name: 'w' } })
}

describe('wasm metadata-store', () => {
  beforeEach(() => {
    localStorage.clear()
    setFingerprint('fp1')
  })

  it('merges separate field patches instead of overwriting', () => {
    setMovementMetadata(1, { [BARK_WEB_METADATA_KEY]: { label: 'coffee' } })
    setMovementMetadata(1, { [BARK_WEB_METADATA_KEY]: { tags: ['food'] } })
    expect(getMovementMetadata(1)).toStrictEqual({
      [BARK_WEB_METADATA_KEY]: { label: 'coffee', tags: ['food'] }
    })
  })

  it('deletes a field when patched with null', () => {
    setMovementMetadata(1, { [BARK_WEB_METADATA_KEY]: { label: 'x', tags: ['a'] } })
    setMovementMetadata(1, { [BARK_WEB_METADATA_KEY]: { label: null } })
    expect(getMovementMetadata(1)).toStrictEqual({ [BARK_WEB_METADATA_KEY]: { tags: ['a'] } })
  })

  it('namespaces metadata by wallet fingerprint', () => {
    setMovementMetadata(1, { [BARK_WEB_METADATA_KEY]: { label: 'a' } })
    setFingerprint('fp2')
    expect(getMovementMetadata(1)).toBeUndefined()
  })

  it('ignores writes when no wallet is set', () => {
    useWalletStore.setState({ wallet: null })
    setMovementMetadata(1, { [BARK_WEB_METADATA_KEY]: { label: 'a' } })
    setFingerprint('fp1')
    expect(getMovementMetadata(1)).toBeUndefined()
  })
})
