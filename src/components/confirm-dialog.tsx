import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  loading = false,
  onConfirm
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  function handleCancel() {
    if (loading) {
      return
    }
    onOpenChange(false)
  }

  const hasDescription = description !== undefined && description.length > 0
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby={undefined} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {hasDescription ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button disabled={loading} onClick={handleCancel} variant="outline">
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button loading={loading} onClick={onConfirm} variant={variant}>
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
