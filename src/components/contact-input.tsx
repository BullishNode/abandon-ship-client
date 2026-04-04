import { PlusIcon, XIcon } from '@phosphor-icons/react'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useMetadataStore } from '@/stores/metadata'

interface ContactInputProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  disabled?: boolean
}

export function ContactInput({
  value,
  onChange,
  disabled = false
}: ContactInputProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { contacts, addContact } = useMetadataStore()

  const sanitizedSearch = search.trim()

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(sanitizedSearch.toLowerCase())
  )

  const exactMatchExists = contacts.some(
    (contact) => contact.name.toLowerCase() === sanitizedSearch.toLowerCase()
  )

  const showCreateOption = sanitizedSearch && !exactMatchExists

  const handleSelect = (contactId: string) => {
    onChange(contactId === value ? undefined : contactId)
    setOpen(false)
  }

  const handleCreate = () => {
    if (!sanitizedSearch) {
      return
    }

    const newContact = addContact(sanitizedSearch)
    onChange(newContact.id)
    setSearch('')
    setOpen(false)
  }

  const selectedContact = value
    ? contacts.find((c) => c.id === value)
    : undefined

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            buttonVariants({
              variant: 'outline',
              className:
                'h-9 w-full justify-between font-normal hover:bg-transparent aria-expanded:bg-transparent'
            })
          )}
          disabled={disabled}
          type="button"
        >
          {selectedContact && <span>{selectedContact.name}</span>}
          {selectedContact && (
            <button
              className="group cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onChange(undefined)
              }}
              type="button"
            >
              <XIcon className="size-4 text-muted-foreground group-hover:text-foreground" />
            </button>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showCreateOption) {
                e.preventDefault()
                handleCreate()
              }
            }}
            onValueChange={setSearch}
            placeholder={t('contacts.search')}
            value={search}
          />
          <p className="p-1.5 text-muted-foreground text-xs">
            {t('contacts.hint')}
          </p>
          <CommandList>
            {filteredContacts.length > 0 && (
              <CommandGroup>
                {filteredContacts.map((contact) => (
                  <CommandItem
                    className="cursor-pointer"
                    data-checked={value === contact.id}
                    key={contact.id}
                    onSelect={() => handleSelect(contact.id)}
                  >
                    <span className={cn(value === contact.id && 'font-medium')}>
                      {contact.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreateOption && (
              <CommandGroup>
                <CommandItem onSelect={handleCreate}>
                  <PlusIcon className="size-4" />
                  {t('contacts.create', { search: sanitizedSearch })}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
