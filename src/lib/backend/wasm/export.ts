import { onchainDbName } from '@/lib/backend/wasm/config'
import { encodeValue } from '@/lib/backend/wasm/export-codec'
import type { EncodedValue } from '@/lib/backend/wasm/export-codec'
import { MOVEMENT_METADATA_STORAGE_KEY } from '@/lib/backend/wasm/metadata-store'
import { canEnumerateDatabases } from '@/lib/backend/wasm/idb'
import { config } from '@/config/runtime'
import { useWalletStore } from '@/stores/wallet'

// "Export db" for WASM mode: serialize the wallet's IndexedDB databases (the
// shared onchain store plus the ark wallet's fingerprint-derived stores) and
// the localStorage side-stores into one JSON blob for backup/support. The
// stores are managed by the @secondts/bark persister, so the record schema is
// an implementation detail of the bindings — this export is a faithful dump,
// not a stable interchange format. The encrypted password vault is deliberately
// excluded: it holds the (encrypted) seed, which never belongs next to a
// plaintext wallet-state dump the user may hand to support.

const EXPORT_FORMAT = 'bark-web-wasm-export'
const EXPORT_VERSION = 1

interface ExportedIndex {
  name: string
  keyPath: string | string[]
  unique: boolean
  multiEntry: boolean
}

interface ExportedRecord {
  key: EncodedValue
  value: EncodedValue
}

interface ExportedStore {
  name: string
  keyPath: string | string[] | null
  autoIncrement: boolean
  indexes: ExportedIndex[]
  records: ExportedRecord[]
}

interface ExportedDatabase {
  name: string
  version: number
  stores: ExportedStore[]
}

export interface WalletExport {
  format: typeof EXPORT_FORMAT
  version: number
  network: string
  fingerprint: string | null
  exportedAt: string
  // False when indexedDB.databases() is unavailable and only the onchain store
  // (the one name we can derive) could be included.
  complete: boolean
  databases: ExportedDatabase[]
  localStorage: Record<string, string>
}

async function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  // oxlint-disable-next-line promise/avoid-new
  return await new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result)
    })
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB request failed'))
    })
  })
}

async function openDatabase(name: string): Promise<IDBDatabase> {
  // No version argument: this must attach to the database as-is, never trigger
  // an upgrade that would block on (or block) the wallet worker's connection.
  return await requestToPromise(indexedDB.open(name))
}

function exportedIndexes(store: IDBObjectStore): ExportedIndex[] {
  const indexes: ExportedIndex[] = []
  for (const indexName of store.indexNames) {
    const index = store.index(indexName)
    indexes.push({
      keyPath: index.keyPath,
      multiEntry: index.multiEntry,
      name: index.name,
      unique: index.unique
    })
  }
  return indexes
}

async function dumpStore(database: IDBDatabase, storeName: string): Promise<ExportedStore> {
  const store = database.transaction(storeName, 'readonly').objectStore(storeName)
  const indexes = exportedIndexes(store)
  const [keys, values] = await Promise.all([
    requestToPromise(store.getAllKeys()),
    requestToPromise(store.getAll())
  ])
  const records: ExportedRecord[] = []
  for (const [position, key] of keys.entries()) {
    records.push({ key: await encodeValue(key), value: await encodeValue(values[position]) })
  }
  return {
    autoIncrement: store.autoIncrement,
    indexes,
    keyPath: store.keyPath,
    name: storeName,
    records
  }
}

async function dumpDatabase(name: string): Promise<ExportedDatabase> {
  const database = await openDatabase(name)
  try {
    const stores: ExportedStore[] = []
    for (const storeName of database.objectStoreNames) {
      stores.push(await dumpStore(database, storeName))
    }
    return { name, stores, version: database.version }
  } finally {
    database.close()
  }
}

// The ark wallet's store names are derived from the fingerprint inside the
// bindings, so they can only be discovered by enumeration — the same
// fingerprint-substring match the wallet delete uses. This variant keeps only
// the stores that exist, because a dump opens each name and opening an absent
// database would create it.
async function walletDatabaseNames(
  fingerprint: string | null
): Promise<{ names: string[]; complete: boolean }> {
  const onchain = onchainDbName()
  const hasFingerprint = fingerprint !== null && fingerprint.length > 0
  if (!canEnumerateDatabases()) {
    return { complete: false, names: [onchain] }
  }
  const names = new Set<string>()
  const existing = await indexedDB.databases()
  for (const database of existing) {
    if (database.name === undefined) {
      continue
    }
    if (database.name === onchain || (hasFingerprint && database.name.includes(fingerprint))) {
      names.add(database.name)
    }
  }
  // Without a fingerprint the ark stores cannot be identified, so the dump
  // holds the onchain store alone — flag it partial rather than claim a full
  // backup.
  return { complete: hasFingerprint, names: [...names] }
}

function exportedLocalStorage(): Record<string, string> {
  const entries: Record<string, string> = {}
  for (const key of [MOVEMENT_METADATA_STORAGE_KEY]) {
    const value = localStorage.getItem(key)
    if (value !== null) {
      entries[key] = value
    }
  }
  return entries
}

function exportFilename(): string {
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  return `bark-wallet-${config.network}-${timestamp}.json`
}

export async function exportWalletData(): Promise<{ blob: Blob; filename: string }> {
  const fingerprint = useWalletStore.getState().wallet?.fingerprint ?? null
  const { names, complete } = await walletDatabaseNames(fingerprint)
  const databases: ExportedDatabase[] = []
  for (const name of names) {
    databases.push(await dumpDatabase(name))
  }
  const payload: WalletExport = {
    complete,
    databases,
    exportedAt: new Date().toISOString(),
    fingerprint,
    format: EXPORT_FORMAT,
    localStorage: exportedLocalStorage(),
    network: config.network,
    version: EXPORT_VERSION
  }
  return {
    blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }),
    filename: exportFilename()
  }
}
