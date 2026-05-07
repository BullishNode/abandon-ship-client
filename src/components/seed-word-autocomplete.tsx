import { Command as CommandPrimitive } from 'cmdk'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from './ui/command'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from './ui/input-group'
import { Popover, PopoverAnchor, PopoverContent } from './ui/popover'

interface SeedWordAutocompleteProps {
  selectedValue: string
  onSelectedValueChange: (value: string) => void
  searchValue: string
  onSearchValueChange: (value: string) => void
  items: { value: string; label: string }[]
  emptyMessage?: string
  placeholder?: string
  iconLeft: ReactNode
}

export function SeedWordAutocomplete({
  selectedValue,
  onSelectedValueChange,
  searchValue,
  onSearchValueChange,
  items,
  emptyMessage = 'No matches',
  iconLeft
}: SeedWordAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [hasError, setHasError] = useState(false)
  const inputRef = useRef<HTMLDivElement>(null)

  const labels: Record<string, string> = {}
  for (const item of items) {
    labels[item.value] = item.label
  }

  function reset() {
    onSelectedValueChange('')
    onSearchValueChange('')
    setHasError(false)
  }

  function onInputBlur() {
    const normalized = searchValue.toLowerCase()

    if (labels[normalized]) {
      onSelectedValueChange(normalized)
      onSearchValueChange(labels[normalized])
      setHasError(false)
    } else if (searchValue.length > 0) {
      setHasError(true)
    }
  }

  function onSelectItem(inputValue: string) {
    if (inputValue === selectedValue) {
      reset()
    } else {
      onSelectedValueChange(inputValue)
      onSearchValueChange(labels[inputValue] ?? '')
      setHasError(false)
    }
    setOpen(false)
  }

  function handleSearchValueChange(value: string) {
    const filteredValue = value.replaceAll(/[^a-zA-Z]/g, '').toLowerCase()

    onSearchValueChange(filteredValue)
    if (hasError) {
      setHasError(false)
    }

    const isCorrect = labels[filteredValue] !== undefined

    if (isCorrect) {
      onSelectedValueChange(filteredValue)
      setOpen(false)
    } else {
      onSelectedValueChange('')
      if (filteredValue.length > 0) {
        setOpen(true)
      } else {
        setOpen(false)
      }
    }
  }

  return (
    <div className="flex items-center" ref={inputRef}>
      <Popover onOpenChange={setOpen} open={open}>
        <Command shouldFilter={false}>
          <PopoverAnchor asChild>
            <InputGroup data-error={hasError || undefined}>
              <InputGroupAddon>
                <InputGroupText>{iconLeft}</InputGroupText>
              </InputGroupAddon>
              <CommandPrimitive.Input
                asChild
                onBlur={onInputBlur}
                onFocus={() => {
                  const normalized = searchValue.toLowerCase()
                  const isCorrect = !!labels[normalized]
                  if (searchValue.length > 0 && !isCorrect) {
                    setOpen(true)
                  }
                }}
                onMouseDown={() => {
                  if (open) {
                    setOpen(false)
                  } else {
                    const normalized = searchValue.toLowerCase()
                    const isCorrect = !!labels[normalized]
                    if (searchValue.length > 0 && !isCorrect) {
                      setOpen(true)
                    }
                  }
                }}
                onValueChange={handleSearchValueChange}
                value={searchValue}
              >
                <InputGroupInput aria-invalid={hasError} />
              </CommandPrimitive.Input>
            </InputGroup>
          </PopoverAnchor>
          {!open && <CommandList aria-hidden="true" className="hidden" />}
          <PopoverContent
            align="start"
            asChild
            className="w-(--radix-popover-trigger-width) p-0"
            onInteractOutside={(e) => {
              if (
                e.target instanceof Element &&
                inputRef.current !== null &&
                inputRef.current.contains(e.target)
              ) {
                e.preventDefault()
              }
            }}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <CommandList>
              {items.length > 0 ? (
                <CommandGroup>
                  {items.map((option) => (
                    <CommandItem
                      key={option.value}
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={onSelectItem}
                      value={option.value}
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                searchValue.length > 0 && <CommandEmpty>{emptyMessage}</CommandEmpty>
              )}
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>
    </div>
  )
}
