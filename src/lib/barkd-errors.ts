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

export async function isWalletAlreadyExistsError(error: unknown): Promise<boolean> {
  if (!(error instanceof ResponseError)) {
    return false
  }
  const body = await readJsonBody(error.response)
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return false
  }
  const { message } = body
  if (typeof message !== 'string') {
    return false
  }
  return WALLET_EXISTS_MESSAGES.some((known) => message.includes(known))
}
