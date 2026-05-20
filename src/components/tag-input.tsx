import { PlusIcon, XIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useMetadataStore } from '@/stores/metadata'

interface TagInputProps {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

export function TagInput({ value, onChange, disabled = false }: TagInputProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { tags, addTag } = useMetadataStore()

  const sanitizedSearch = search.replaceAll(',', '').trim()

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(sanitizedSearch.toLowerCase())
  )

  const exactMatchExists = tags.some(
    (tag) => tag.name.toLowerCase() === sanitizedSearch.toLowerCase()
  )

  const showCreateOption = sanitizedSearch.length > 0 && !exactMatchExists

  function handleSelect(tagName: string) {
    if (value.includes(tagName)) {
      onChange(value.filter((name) => name !== tagName))
    } else {
      onChange([...value, tagName])
    }
  }

  function handleCreate() {
    if (!sanitizedSearch) {
      return
    }

    const tagName = addTag(sanitizedSearch)
    onChange([...value, tagName])
    setSearch('')
  }

  const selectedTags = value.flatMap((name) => {
    const tag = tags.find((item) => item.name === name)
    return tag ? [tag] : []
  })

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <div
          aria-disabled={disabled}
          className={cn(
            buttonVariants({
              className:
                'h-auto min-h-9 w-full flex-wrap justify-start gap-x-1 gap-y-1.5 py-1.5 font-normal hover:bg-transparent aria-expanded:bg-transparent',
              variant: 'outline'
            }),
            disabled && 'pointer-events-none opacity-50'
          )}
          onKeyDown={(e) => {
            if (disabled) {
              return
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen((prev) => !prev)
            }
          }}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="button"
          tabIndex={disabled ? -1 : 0}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {selectedTags.map((tag) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: don't open popover when clicking on the tag text
              <m.div
                animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
                className="inline-flex cursor-default items-center gap-1 whitespace-nowrap rounded-md bg-muted px-2 py-0.5 text-foreground text-xs"
                exit={{ filter: 'blur(8px)', opacity: 0, scale: 0.92 }}
                initial={{ filter: 'blur(8px)', opacity: 0, scale: 0.92 }}
                key={tag.name}
                layout
                onClick={(e) => e.stopPropagation()}
                role="presentation"
                transition={{
                  duration: 0.28,
                  ease: [0.2, 0, 0, 1]
                }}
              >
                <span>{tag.name}</span>
                <button
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleSelect(tag.name)
                  }}
                  type="button"
                >
                  <XIcon className="size-3 rounded-sm hover:bg-foreground/20" />
                </button>
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showCreateOption) {
                e.preventDefault()
                handleCreate()
              }
            }}
            onValueChange={setSearch}
            placeholder={t('tags.search')}
            value={search}
          />
          <p className="p-1.5 text-muted-foreground text-xs">{t('tags.hint')}</p>
          <CommandList>
            {filteredTags.length > 0 && (
              <CommandGroup>
                {filteredTags.map((tag) => (
                  <CommandItem
                    className="cursor-pointer"
                    data-checked={value.includes(tag.name)}
                    key={tag.name}
                    onSelect={() => handleSelect(tag.name)}
                  >
                    <span className={cn(value.includes(tag.name) && 'font-medium')}>
                      {tag.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreateOption && (
              <CommandGroup>
                <CommandItem onSelect={handleCreate}>
                  <PlusIcon className="size-4" />
                  {t('tags.create', { search: sanitizedSearch })}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
