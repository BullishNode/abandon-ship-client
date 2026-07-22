export const P2TR_DUST_SAT = 330

export type BoardAmountValidation =
  | 'below_dust'
  | 'below_min'
  | 'empty'
  | 'insufficient_funds'
  | 'valid'

export function validateBoardAmount(
  amountSat: number | undefined,
  onchainSpendableSat: number,
  minBoardAmountSat?: number,
  netAmountSat?: number
): BoardAmountValidation {
  if (amountSat === undefined || amountSat <= 0) {
    return 'empty'
  }
  if (amountSat > onchainSpendableSat) {
    return 'insufficient_funds'
  }
  if (minBoardAmountSat !== undefined && amountSat < minBoardAmountSat) {
    return 'below_min'
  }
  if (netAmountSat !== undefined && netAmountSat < P2TR_DUST_SAT) {
    return 'below_dust'
  }
  return 'valid'
}
