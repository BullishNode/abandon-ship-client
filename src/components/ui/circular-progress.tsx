import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  circleStrokeWidth?: number
  progressStrokeWidth?: number
  shape?: 'round' | 'butt' | 'square'
  showLabel?: boolean
  renderLabel?: (value: number) => ReactNode
  className?: string
  progressClassName?: string
  labelClassName?: string
}

const MIN_VALUE = 0
const MAX_VALUE = 100
const DEFAULT_SIZE = 100
const DEFAULT_STROKE_WIDTH = 10

function clamp(value: number): number {
  return Math.min(Math.max(value, MIN_VALUE), MAX_VALUE)
}

export function CircularProgress({
  value,
  size = DEFAULT_SIZE,
  strokeWidth,
  circleStrokeWidth = DEFAULT_STROKE_WIDTH,
  progressStrokeWidth = DEFAULT_STROKE_WIDTH,
  shape = 'round',
  showLabel = false,
  renderLabel,
  className,
  progressClassName,
  labelClassName
}: CircularProgressProps) {
  const safeValue = clamp(value)
  const baseStroke = strokeWidth ?? Math.max(circleStrokeWidth, progressStrokeWidth)
  const radius = size / 2 - baseStroke / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * ((MAX_VALUE - safeValue) / MAX_VALUE)

  return (
    <div className="relative inline-flex" style={{ height: size, width: size }}>
      <svg
        aria-hidden="true"
        className="-rotate-90 block"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className={cn('stroke-muted', className)}
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          strokeWidth={strokeWidth ?? circleStrokeWidth}
        />
        <circle
          className={cn(
            'stroke-foreground transition-[stroke-dashoffset] duration-1000 ease-linear',
            progressClassName
          )}
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap={shape}
          strokeWidth={strokeWidth ?? progressStrokeWidth}
        />
      </svg>
      {showLabel ? (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center text-sm',
            labelClassName
          )}
        >
          {renderLabel ? renderLabel(safeValue) : safeValue}
        </div>
      ) : null}
    </div>
  )
}
