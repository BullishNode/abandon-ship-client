// Build-time switches behind intent-named flags, in one module so tests can
// exercise either backend (vitest compiles with the barkd literal baked in).
export const supportsWalletPassword = __BACKEND__ === 'wasm'

// barkd needs the wallet birthday when recovering against a bitcoind chain
// source; WASM's `OpenWalletArgs` has no such field, so the value is ignored.
export const supportsBirthdayHeight = __BACKEND__ !== 'wasm'

// WASM recovery leans on the Ark server's seed-recovery mailbox scan, which
// tells the server which VTXOs belong to the seed.
export const usesServerAssistedRecovery = __BACKEND__ === 'wasm'
