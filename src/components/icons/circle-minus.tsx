interface CircleStatusIconProps {
  className?: string
}

export function CircleMinusIcon({ className }: CircleStatusIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      height="32"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" fill="currentColor" r="16" />
      <path d="M10 16H22" stroke="#fff" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  )
}
