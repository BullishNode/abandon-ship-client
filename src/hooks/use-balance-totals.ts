import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useOnchainTransactions } from '@/hooks/barkd/use-onchain-transactions'
import { useOnchainUtxos } from '@/hooks/barkd/use-onchain-utxos'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import type { BalanceTotals } from '@/utils/balance'
import { getBalanceTotals } from '@/utils/balance'

export function useBalanceTotals(): BalanceTotals {
  const { data: balance } = useWalletBalance()
  const { data: onchainBalance } = useOnchainBalance()
  const { data: onchainTransactions } = useOnchainTransactions()
  const { data: onchainUtxos } = useOnchainUtxos()
  return getBalanceTotals(balance, onchainBalance, onchainTransactions, onchainUtxos)
}
