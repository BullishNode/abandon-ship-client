// Backend-agnostic error → user-facing description. The barkd body parsing
// (ResponseError JSON) loads through a build-time-guarded dynamic import so the
// vendor barkd client is dead-code-eliminated from wasm bundles, where errors
// are plain Errors whose message is already the description.
export async function backendErrorMessage(error: unknown): Promise<string | undefined> {
  if (__BACKEND__ !== 'wasm') {
    const { barkdErrorMessage } = await import('@/lib/backend/barkd/errors')
    return await barkdErrorMessage(error)
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return undefined
}
