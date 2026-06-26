interface CircleStatusIconProps {
  className?: string
}

export function CircleXIcon({ className }: CircleStatusIconProps) {
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
      <path
        d="M11 11L21 21M21 11L11 21"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  )
}
