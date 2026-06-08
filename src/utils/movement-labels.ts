import type { Movement } from '@secondts/barkd'
import type { TFunction } from 'i18next'
import { isExitSubsystem } from '@/utils/movement'

export function getMovementDefaultLabel(subsystem: Movement['subsystem'], t: TFunction): string {
  if (subsystem.kind === 'refresh') {
    return t('movements.kinds.refresh')
  }
  if (isExitSubsystem(subsystem.name)) {
    return t('movements.kinds.exit')
  }
  return ''
}

export function getOnchainDefaultLabel(isCpfp: boolean, t: TFunction): string {
  return isCpfp ? t('movements.onchain.exit_fee_label') : ''
}
