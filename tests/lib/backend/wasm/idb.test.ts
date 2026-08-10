import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase, hasDatabase, walletDatabaseNames } from '@/lib/backend/wasm/idb'

const ONCHAIN_DB = 'bark-onchain-signet'
const FINGERPRINT = 'a1b2c3d4'

async function createDatabase(name: string): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.addEventListener('success', () => {
      resolve(request.result)
    })
    request.addEventListener('error', () => {
      reject(request.error ?? new Error(`open ${name} failed`))
    })
  })
  db.close()
}

describe('wasm idb helpers', () => {
  beforeEach(async () => {
    for (const db of await indexedDB.databases()) {
      if (db.name !== undefined) {
        await deleteDatabase(db.name)
      }
    }
  })

  it('reports whether a database exists', async () => {
    await expect(hasDatabase(ONCHAIN_DB)).resolves.toBeFalsy()
    await createDatabase(ONCHAIN_DB)
    await expect(hasDatabase(ONCHAIN_DB)).resolves.toBeTruthy()
  })

  it('deletes a database', async () => {
    await createDatabase(ONCHAIN_DB)
    await expect(deleteDatabase(ONCHAIN_DB)).resolves.toBeTruthy()
    await expect(hasDatabase(ONCHAIN_DB)).resolves.toBeFalsy()
  })

  it('collects the onchain store and every fingerprint-derived store', async () => {
    await createDatabase(ONCHAIN_DB)
    await createDatabase(FINGERPRINT)
    await createDatabase(`${FINGERPRINT}-exits`)
    await createDatabase('bark-onchain-mainnet')

    const names = await walletDatabaseNames(ONCHAIN_DB, FINGERPRINT)

    expect(names.toSorted()).toStrictEqual(
      [ONCHAIN_DB, FINGERPRINT, `${FINGERPRINT}-exits`].toSorted()
    )
  })

  it('never matches other wallets when the fingerprint is missing', async () => {
    await createDatabase('bark-onchain-mainnet')

    await expect(walletDatabaseNames(ONCHAIN_DB, null)).resolves.toStrictEqual([ONCHAIN_DB])
    await expect(walletDatabaseNames(ONCHAIN_DB, '')).resolves.toStrictEqual([ONCHAIN_DB])
  })
})
