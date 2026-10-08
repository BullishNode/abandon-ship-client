import {
  BalanceFromJSON,
  CreateWalletRequestToJSON,
  BitcoinApi,
  BoardsApi,
  ExitsApi,
  FeesApi,
  HistoryApi,
  LightningApi,
  OnchainApi,
  WalletApi
} from '@secondts/barkd'
import { config } from '@/config/runtime'
import { clientConfig } from '@/lib/backend/barkd/client-config'
import { ExpiryPayoutsApi } from '@/lib/backend/barkd/expiry-payouts'
import {
  toArkInfo,
  toBalance,
  toEmergencyExitFeeEstimate,
  toExitStatus,
  toFeeEstimate,
  toMovement,
  toNextRoundStart,
  toOnchainBalance,
  toOnchainFeeRates,
  toPendingBoard,
  toPendingRound,
  toUtxo,
  toVtxo,
  toWalletTx
} from '@/lib/backend/barkd/map'
import { subscribeNotifications } from '@/lib/backend/barkd/notifications'
import { revealMnemonic } from '@/lib/backend/barkd/reveal-mnemonic'
import type { Backend } from '@/types/backend'
import { refreshingVtxosFromRounds } from '@/utils/refresh'

const walletApi = new WalletApi(clientConfig)
const boardsApi = new BoardsApi(clientConfig)
const historyApi = new HistoryApi(clientConfig)
const onchainApi = new OnchainApi(clientConfig)
const feesApi = new FeesApi(clientConfig)
const lightningApi = new LightningApi(clientConfig)
const exitsApi = new ExitsApi(clientConfig)
const bitcoinApi = new BitcoinApi(clientConfig)
const expiryPayoutsApi = new ExpiryPayoutsApi(clientConfig)

export const barkdBackend: Backend = {
  bitcoinApi: {
    tip: async () => {
      const response = await bitcoinApi.tip()
      return response.tipHeight
    }
  },
  boardsApi: {
    boardAll: async () => toPendingBoard(await boardsApi.boardAll()),
    boardAmount: async ({ amountSats }) =>
      toPendingBoard(await boardsApi.boardAmount({ boardRequest: { amountSat: amountSats } }))
  },
  exitsApi: {
    emergencyExitFee: async ({ vtxos, feeRateSatPerVb, destination }) =>
      toEmergencyExitFeeEstimate(
        await exitsApi.emergencyExitFee({
          destination,
          feeRateSatPerVb,
          vtxoIds: vtxos.length > 0 ? vtxos.join(',') : undefined
        })
      ),
    exitClaimVtxos: async ({ destination, vtxos, feeRate }) =>
      await exitsApi.exitClaimVtxos({
        exitClaimVtxosRequest: { destination, feeRate, vtxos }
      }),
    exitStartAll: async () => await exitsApi.exitStartAll(),
    exitStartVtxos: async ({ vtxos }) =>
      await exitsApi.exitStartVtxos({ exitStartRequest: { vtxos } }),
    getAllExitStatus: async () => {
      const statuses = await exitsApi.getAllExitStatus({})
      return statuses.map(toExitStatus)
    }
  },
  feesApi: {
    boardFee: async ({ amountSats }) =>
      toFeeEstimate(await feesApi.boardFee({ amountSat: amountSats })),
    lightningSendFee: async ({ amountSats }) =>
      toFeeEstimate(await feesApi.lightningSendFee({ amountSat: amountSats })),
    offboardFee: async ({ address, vtxos }) =>
      toFeeEstimate(await feesApi.offboardFee({ offboardFeeEstimateRequest: { address, vtxos } })),
    onchainFeeRates: async () => toOnchainFeeRates(await feesApi.onchainFeeRates()),
    sendOnchainFee: async ({ address, amountSats }) =>
      toFeeEstimate(await feesApi.sendOnchainFee({ address, amountSat: amountSats }))
  },
  historyApi: {
    list: async () => {
      const movements = await historyApi.list()
      return movements.map(toMovement)
    },
    updateMetadata: async ({ id, metadata }) => {
      await historyApi.updateMetadata({ body: metadata, id })
    }
  },
  lightningApi: {
    generateInvoice: async ({ amountSats, description }) =>
      await lightningApi.generateInvoice({
        lightningInvoiceRequest: { amountSat: amountSats, description }
      })
  },
  notifications: { subscribe: subscribeNotifications },
  onchainApi: {
    onchainAddress: async () => {
      const response = await onchainApi.onchainAddress()
      return response.address
    },
    onchainBalance: async () => toOnchainBalance(await onchainApi.onchainBalance()),
    onchainSend: async ({ destination, amountSats }) =>
      await onchainApi.onchainSend({
        onchainSendRequest: { amountSat: amountSats, destination }
      }),
    onchainTransactions: async () => {
      const txs = await onchainApi.onchainTransactions()
      return txs.map(toWalletTx)
    },
    onchainUtxos: async () => {
      const utxos = await onchainApi.onchainUtxos()
      return utxos.map(toUtxo)
    },
    sweepExpiryPayouts: async () => await expiryPayoutsApi.sweepExpiryPayouts()
  },
  walletApi: {
    address: async () => {
      const response = await walletApi.address()
      return response.address
    },
    adoptServerVtxoStatus: async ({ vtxos }) => await expiryPayoutsApi.adoptServerVtxoStatus(vtxos),
    arkInfo: async () => toArkInfo(await walletApi.arkInfo()),
    balance: async () => {
      const response = await walletApi.balanceRaw()
      const json: unknown = await response.raw.json()
      return toBalance(BalanceFromJSON(json), json)
    },
    createWallet: async ({ mnemonic, birthdayHeight, restore }) => {
      const request = {
        arkServer: config.arkServer,
        birthdayHeight,
        chainSource: config.chainSource,
        mnemonic,
        network: config.network
      }
      // This extension is not yet in the generated client. Restores retain
      // their scan range; only the create screen marks a fresh seed.
      return await walletApi
        .withPreMiddleware(({ url, init }) =>
          Promise.resolve({
            init: {
              ...init,
              body: JSON.stringify({
                ...CreateWalletRequestToJSON(request),
                fresh_mnemonic: restore === false
              })
            },
            url
          })
        )
        .createWallet({ createWalletRequest: request })
    },
    findExpiryPayouts: async () => await expiryPayoutsApi.findExpiryPayouts(),
    mnemonic: async () => await revealMnemonic(),
    nextRound: async () => toNextRoundStart(await walletApi.nextRound()),
    offboardVtxos: async ({ vtxos, address }) =>
      await walletApi.offboardVtxos({ offboardVtxosRequest: { address, vtxos } }),
    pendingRounds: async () => {
      const rounds = await walletApi.pendingRounds()
      return rounds.map(toPendingRound)
    },
    refreshAll: async () => toPendingRound(await walletApi.refreshAll()),
    refreshVtxos: async ({ vtxos }) =>
      toPendingRound(await walletApi.refreshVtxos({ refreshRequest: { vtxos } })),
    refreshingVtxos: async () => {
      const rounds = await walletApi.pendingRounds()
      return refreshingVtxosFromRounds(rounds.map(toPendingRound))
    },
    send: async ({ destination, amountSats, comment }) =>
      await walletApi.send({ sendRequest: { amountSat: amountSats, comment, destination } }),
    sendOnchain: async ({ destination, amountSats }) =>
      await walletApi.sendOnchain({
        sendOnchainRequest: { amountSat: amountSats, destination }
      }),
    vtxoEncoded: async (id) => {
      const response = await walletApi.getVtxoEncoded({ id })
      return response.encoded
    },
    vtxos: async (params) => {
      const vtxos = await walletApi.vtxos({ all: params?.all })
      return vtxos.map(toVtxo)
    },
    walletDelete: async ({ fingerprint, dangerous }) =>
      await walletApi.walletDelete({ walletDeleteRequest: { dangerous, fingerprint } }),
    walletExists: async () => await walletApi.walletExists()
  }
}
