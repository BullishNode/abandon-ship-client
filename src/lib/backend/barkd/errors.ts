import { ResponseError } from '@secondts/barkd'

// barkd has no stable status code for these cases, so we match its error
// messages until one exists. "Datadir has unexpected contents" comes from
// bark-cli's check_clean_datadir (wallet files on disk); "Wallet already set"
// comes from bark-rest's create_wallet handler (wallet loaded in memory).
const WALLET_EXISTS_MESSAGES = ['Datadir has unexpected contents', 'Wallet already set'] as const

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json()
  } catch {
    return null
  }
}

export async function barkdErrorMessage(error: unknown): Promise<string | undefined> {
  if (error instanceof ResponseError) {
    const body = await readJsonBody(error.response)
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const { message } = body
      if (typeof message === 'string' && message.length > 0) {
        return message
      }
    }
    return undefined
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return undefined
}

// A barkd without a route answers 404, or 405 when the path exists for
// another method.
export function isRouteNotFoundError(error: unknown): boolean {
  return (
    error instanceof ResponseError &&
    (error.response.status === 404 || error.response.status === 405)
  )
}

export async function isWalletAlreadyExistsError(error: unknown): Promise<boolean> {
  if (!(error instanceof ResponseError)) {
    return false
  }
  const message = await barkdErrorMessage(error)
  if (message === undefined) {
    return false
  }
  return WALLET_EXISTS_MESSAGES.some((known) => message.includes(known))
}
