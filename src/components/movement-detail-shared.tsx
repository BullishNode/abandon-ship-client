import { CheckIcon, CopyIcon, PencilSimpleIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const COPY_RESET_MS = 1500

interface DetailRowProps {
  label: string
  value: string
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  )
}

interface CopyableValueRowProps {
  label: string
  value: string
}

export function CopyableValueRow({ label, value }: CopyableValueRowProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), COPY_RESET_MS)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex max-w-[70%] items-start gap-2">
        <span className="break-all font-mono text-xs">{value}</span>
        <Button
          aria-label={copied ? t('movements.detail.copied') : t('movements.detail.copy')}
          onClick={() => {
            void copyValue()
          }}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </div>
  )
}

interface LabelEditorProps {
  inputId: string
  label: string
  onSave: (label: string) => void
}

export function LabelEditor({ inputId, label, onSave }: LabelEditorProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  function startEditing() {
    setDraft(label)
    setEditing(true)
  }
  function handleCancel() {
    setDraft(label)
    setEditing(false)
  }
  function handleSave() {
    onSave(draft.trim())
    setEditing(false)
  }
  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t('movements.detail.label')}</Label>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            id={inputId}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleSave()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                handleCancel()
              }
            }}
            placeholder={t('movements.detail.label_placeholder')}
            value={draft}
          />
          <Button onClick={handleSave} size="sm" type="button">
            {t('movements.detail.save')}
          </Button>
          <Button onClick={handleCancel} size="sm" type="button" variant="ghost">
            {t('movements.detail.cancel')}
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <Label>{t('movements.detail.label')}</Label>
      <div className="flex items-center gap-2">
        <span
          className={
            label.length > 0 ? 'flex-1 text-foreground' : 'flex-1 text-muted-foreground italic'
          }
        >
          {label.length > 0 ? label : t('movements.detail.label_placeholder')}
        </span>
        <Button
          aria-label={t('movements.detail.edit')}
          onClick={startEditing}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <PencilSimpleIcon />
        </Button>
      </div>
    </div>
  )
}
