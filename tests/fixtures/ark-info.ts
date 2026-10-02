import type { ArkInfo } from '@/types/domain/ark'

export const ARK_INFO: ArkInfo = {
  fees: {
    board: { baseFeeSats: 0, minFeeSats: 0, ppm: 0 },
    lightningReceive: { baseFeeSats: 0, ppm: 0 },
    lightningSend: { baseFeeSats: 0, minFeeSats: 0, ppmExpiryTable: [] },
    offboard: { baseFeeSats: 0, fixedAdditionalVb: 0, ppmExpiryTable: [] },
    refresh: { baseFeeSats: 0, ppmExpiryTable: [] }
  },
  htlcExpiryDelta: 6,
  htlcSendExpiryDelta: 6,
  lnReceiveAntiDosRequired: false,
  maxUserInvoiceCltvDelta: 144,
  maxVtxoExitDepth: 4,
  minBoardAmountSats: 5000,
  nbRoundNonces: 2,
  network: 'signet',
  requiredBoardConfirmations: 1,
  roundInterval: '30s',
  serverPubkey: '02deadbeef',
  vtxoExitDelta: 12,
  vtxoExpiryDelta: 144
}
