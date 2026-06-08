import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import type { MetadataStore } from '@/stores/metadata'
import { useMetadataStore } from '@/stores/metadata'
import { useWalletStore } from '@/stores/wallet'
import { getOnchainDefaultLabel } from '@/utils/movement-labels'

interface OnchainLabelCellProps {
  txid: string
  bindingAddress: string | undefined
  isCpfp: boolean
}

const EMPTY_TAGS: string[] = []

function selectLabelSource(
  state: MetadataStore,
  fingerprint: string | undefined,
  txid: string,
  bindingAddress: string | undefined
): { label: string; tags: string[] } {
  if (fingerprint === undefined) {
    return { label: '', tags: EMPTY_TAGS }
  }
  const annotation = state.onchainAnnotations[fingerprint]?.[txid]
  if (annotation !== undefined) {
    return { label: annotation.label?.trim() ?? '', tags: annotation.tags }
  }
  if (bindingAddress === undefined) {
    return { label: '', tags: EMPTY_TAGS }
  }
  const walletBindings = state.bindings[fingerprint] ?? []
  const binding = walletBindings.find((b) => b.destinations.includes(bindingAddress))
  if (binding === undefined) {
    return { label: '', tags: EMPTY_TAGS }
  }
  return { label: binding.label?.trim() ?? '', tags: binding.tags }
}

export function OnchainLabelCell({ txid, bindingAddress, isCpfp }: OnchainLabelCellProps) {
  const { t } = useTranslation()
  const fingerprint = useWalletStore((state) => state.wallet?.fingerprint)
  const { label, tags } = useMetadataStore(
    useShallow((state) => selectLabelSource(state, fingerprint, txid, bindingAddress))
  )
  const resolvedLabel = label.length === 0 ? getOnchainDefaultLabel(isCpfp, t) : label
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {resolvedLabel.length > 0 ? <span className="text-foreground">{resolvedLabel}</span> : null}
      {tags.map((tag) => (
        <Badge key={tag} variant="muted">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
