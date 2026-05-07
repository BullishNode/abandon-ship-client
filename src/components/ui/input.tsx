import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  endTextAddOn?: React.ReactNode
}

function Input({ className, type, endTextAddOn, ...props }: InputProps) {
  const inputElement = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 rounded-md border bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] file:h-7 file:text-sm file:font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        endTextAddOn !== undefined && "peer pr-13",
        className
      )}
      {...props}
    />
  )

  if (endTextAddOn === undefined) {
    return inputElement
  }

  return (
    <div className="relative">
      {inputElement}
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3 text-muted-foreground text-sm peer-disabled:opacity-50">
        {endTextAddOn}
      </span>
    </div>
  )
}

export { Input }
