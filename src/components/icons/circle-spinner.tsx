interface CircleStatusIconProps {
  className?: string
}

export function CircleSpinnerIcon({ className }: CircleStatusIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      height="32"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" opacity="0.25" r="14" stroke="currentColor" strokeWidth="4" />
      <path
        d="M16 2A14 14 0 0 1 30 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  )
}
