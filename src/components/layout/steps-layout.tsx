import { cn } from '@/lib/utils'

function StepsLayout({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex w-full flex-col items-center gap-[10vh]', className)}
      {...props}
    />
  )
}

import React from 'react'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend
} from '../ui/field'

function StepsLayoutNav({
  className,
  children,
  ...props
}: React.ComponentProps<'nav'>) {
  return (
    <nav className={cn('w-full', className)} {...props}>
      <ol className="flex gap-4">
        {React.Children.map(children, (child) => (
          <li className="w-full">{child}</li>
        ))}
      </ol>
    </nav>
  )
}

function StepsLayoutForm({
  className,
  ...props
}: React.ComponentProps<'form'>) {
  return (
    <form
      className={cn(
        'flex w-full max-w-lg flex-col items-center gap-8',
        className
      )}
      {...props}
    />
  )
}

function StepsLayoutContent({
  title,
  description,
  error,
  className,
  children,
  ...props
}: {
  title: string
  description: string
  error?: string
} & React.ComponentProps<'div'>) {
  return (
    <FieldGroup className={cn('items-center', className)} {...props}>
      <div>
        <FieldLegend className="text-center font-bold data-[variant=legend]:text-3xl">
          {title}
        </FieldLegend>
        {error ? (
          <FieldError className="text-pretty text-center text-destructive text-lg">
            {error}
          </FieldError>
        ) : (
          <FieldDescription className="text-pretty text-center text-foreground text-lg">
            {description}
          </FieldDescription>
        )}
      </div>
      {children}
    </FieldGroup>
  )
}

function StepsLayoutContentAction({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <Field
      className={cn('justify-center', className)}
      orientation="horizontal"
      {...props}
    />
  )
}

function StepsLayoutFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2', className)} {...props} />
}

export {
  StepsLayout,
  StepsLayoutNav,
  StepsLayoutForm,
  StepsLayoutContent,
  StepsLayoutContentAction,
  StepsLayoutFooter
}
