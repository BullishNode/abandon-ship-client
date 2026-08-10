// IndexedDB helpers shared by the worker (open/cleanup) and the client (wallet
// delete). Both realms see the same origin-scoped databases.

const DELETE_DB_TIMEOUT_MS = 10_000

export function canEnumerateDatabases(): boolean {
  return typeof indexedDB.databases === 'function'
}

// Browsers without `indexedDB.databases()` (e.g. older Firefox) cannot confirm
// absence, so report the database as existing: the only consumer that acts on
// `false` is the openWallet failure cleanup, which must never delete a store it
// cannot prove it just created.
export async function hasDatabase(name: string): Promise<boolean> {
  if (!canEnumerateDatabases()) {
    return true
  }
  const existing = await indexedDB.databases()
  return existing.some((db) => db.name === name)
}

// Resolves true only when the database is really gone. A `blocked` event is not
// terminal — the delete completes (firing `success`) once other connections
// close — so wait for the outcome, bounded by a timeout.
export async function deleteDatabase(name: string): Promise<boolean> {
  const request = indexedDB.deleteDatabase(name)
  // oxlint-disable-next-line promise/avoid-new
  const outcome = new Promise<boolean>((resolve) => {
    request.addEventListener('success', () => {
      resolve(true)
    })
    request.addEventListener('error', () => {
      resolve(false)
    })
  })
  // oxlint-disable-next-line promise/avoid-new
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      resolve(false)
    }, DELETE_DB_TIMEOUT_MS)
  })
  return await Promise.race([outcome, timeout])
}

// Every store belonging to one wallet: the exact onchain DB plus the ark
// wallet's fingerprint-derived DBs. A broader substring match (e.g. 'bark')
// would also destroy other networks' wallets living on the same origin — and an
// empty fingerprint would match everything.
export async function walletDatabaseNames(
  onchainDbName: string,
  fingerprint: string | null
): Promise<string[]> {
  const names = new Set<string>([onchainDbName])
  const hasFingerprint = fingerprint !== null && fingerprint.length > 0
  if (!hasFingerprint || !canEnumerateDatabases()) {
    return [...names]
  }
  const existing = await indexedDB.databases()
  for (const db of existing) {
    if (db.name !== undefined && db.name.includes(fingerprint)) {
      names.add(db.name)
    }
  }
  return [...names]
}
