import { Command as CommandPrimitive } from 'cmdk'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from './ui/command'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from './ui/input-group'
import { Popover, PopoverAnchor, PopoverContent } from './ui/popover'

interface SeedWordAutocompleteProps<T extends string> {
  selectedValue: T
  onSelectedValueChange: (value: T) => void
  searchValue: string
  onSearchValueChange: (value: string) => void
  items: { value: T; label: string }[]
  emptyMessage?: string
  placeholder?: string
  iconLeft: ReactNode
}

export function SeedWordAutocomplete<T extends string>({
  selectedValue,
  onSelectedValueChange,
  searchValue,
  onSearchValueChange,
  items,
  emptyMessage = 'No matches',
  iconLeft
}: SeedWordAutocompleteProps<T>) {
  const [open, setOpen] = useState(false)
  const [hasError, setHasError] = useState(false)
  const inputRef = useRef<HTMLDivElement>(null)

  const labels = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc[item.value] = item.label
          return acc
        },
        {} as Record<string, string>
      ),
    [items]
  )

  const reset = () => {
    onSelectedValueChange('' as T)
    onSearchValueChange('')
    setHasError(false)
  }

  const onInputBlur = () => {
    const normalized = searchValue.toLowerCase()

    if (labels[normalized]) {
      onSelectedValueChange(normalized as T)
      onSearchValueChange(labels[normalized])
      setHasError(false)
    } else if (searchValue.length > 0) {
      setHasError(true)
    }
  }

  const onSelectItem = (inputValue: string) => {
    if (inputValue === selectedValue) {
      reset()
    } else {
      onSelectedValueChange(inputValue as T)
      onSearchValueChange(labels[inputValue] ?? '')
      setHasError(false)
    }
    setOpen(false)
  }

  const handleSearchValueChange = (value: string) => {
    const filteredValue = value.replace(/[^a-zA-Z]/g, '').toLowerCase()

    onSearchValueChange(filteredValue)
    if (hasError) {
      setHasError(false)
    }

    const isCorrect = !!labels[filteredValue]

    if (isCorrect) {
      onSelectedValueChange(filteredValue as T)
      setOpen(false)
    } else {
      onSelectedValueChange('' as T)
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
                inputRef.current?.contains(e.target as Node)
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
                searchValue.length > 0 && (
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                )
              )}
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>
    </div>
  )
}
