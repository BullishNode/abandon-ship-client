import type { ComponentProps } from 'react'

interface SignOutIconProps extends ComponentProps<'svg'> {
  arrowClassName?: string
}

export function SignOutIcon({ arrowClassName, ...props }: SignOutIconProps) {
  return (
    <svg
      fill="currentColor"
      height="1em"
      viewBox="0 0 256 256"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M124,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h68a8,8,0,0,1,0,16H56V208h60A8,8,0,0,1,124,216Z" />
      <path
        className={arrowClassName}
        d="M232.49,119.51l-40-40a8,8,0,0,0-11.32,11.32L207.31,120H104a8,8,0,0,0,0,16H207.31l-26.14,26.17a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,232.49,119.51Z"
      />
    </svg>
  )
}
