interface CircleStatusIconProps {
  className?: string
}

export function CircleLockIcon({ className }: CircleStatusIconProps) {
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
      <rect height="8" rx="1.5" stroke="#fff" strokeWidth="2" width="11" x="10.5" y="15" />
      <path d="M13 15V12.5a3 3 0 0 1 6 0V15" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}
