import { useEffect, useRef } from 'react'
import type { WalletTx } from '@/types/domain/onchain'
import { useOnchainTransactions } from './use-onchain-transactions'

const RECEIVE_POLL_INTERVAL_MS = 5000

interface UseReceivedOnchainPaymentOptions {
  enabled?: boolean
}

export interface ReceivedOnchainPayment {
  amountSat: number
  pending: boolean
}

function findFreshIncoming(transactions: WalletTx[], baseline: Set<string>): WalletTx | undefined {
  return transactions.find((tx) => tx.balanceChangeSats > 0 && !baseline.has(tx.txid))
}

export function useReceivedOnchainPayment(
  handler: (payment: ReceivedOnchainPayment) => void,
  options?: UseReceivedOnchainPaymentOptions
): void {
  const enabled = options?.enabled ?? true
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const baselineRef = useRef<Set<string> | null>(null)
  const handledRef = useRef(false)

  const { data: transactions } = useOnchainTransactions({
    enabled,
    refetchInterval: RECEIVE_POLL_INTERVAL_MS
  })

  useEffect(() => {
    if (!enabled) {
      baselineRef.current = null
      handledRef.current = false
      return
    }
    if (transactions === undefined || handledRef.current) {
      return
    }
    if (baselineRef.current === null) {
      baselineRef.current = new Set(
        transactions.filter((tx) => tx.balanceChangeSats > 0).map((tx) => tx.txid)
      )
      return
    }
    const fresh = findFreshIncoming(transactions, baselineRef.current)
    if (fresh === undefined) {
      return
    }
    handledRef.current = true
    handlerRef.current({
      amountSat: fresh.balanceChangeSats,
      pending: (fresh.confirmation?.height ?? null) === null
    })
  }, [enabled, transactions])
}
