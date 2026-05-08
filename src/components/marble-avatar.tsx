import { cn } from '@/lib/utils'

const SIZE = 80
const BLUR_STD_DEVIATION = 14
const BLOB_RADIUS = SIZE * 0.55
const POSITION_RANGE = SIZE * 0.6
const FILTER_PADDING = SIZE

const DEFAULT_COLORS = [
  'var(--gradient-red)',
  'var(--gradient-blue)',
  'var(--gradient-yellow)'
] as const

const ANCHORS = [
  { cx: SIZE * 0.3, cy: SIZE * 0.3 },
  { cx: SIZE * 0.75, cy: SIZE * 0.4 },
  { cx: SIZE * 0.5, cy: SIZE * 0.8 }
] as const

interface MarbleAvatarProps {
  name: string
  size?: number
  colors?: readonly string[]
  variant?: 'circle' | 'square'
  className?: string
}

interface BlobProperties {
  color: string
  translateX: number
  translateY: number
}

const HASH_PRIME = 31
const HASH_MODULUS = 2_147_483_647

function hashCode(name: string): number {
  let hash = 0
  for (const character of name) {
    const code = character.codePointAt(0) ?? 0
    hash = (hash * HASH_PRIME + code) % HASH_MODULUS
  }
  return Math.abs(hash)
}

function getDigit(num: number, position: number): number {
  return Math.floor((num / 10 ** position) % 10)
}

function getSignedUnit(num: number, range: number, index: number): number {
  const value = num % range
  if (getDigit(num, index) % 2 === 0) {
    return -value
  }
  return value
}

function generateBlobs(name: string, colors: readonly string[]): BlobProperties[] {
  const seed = hashCode(name)
  return ANCHORS.map((_, i) => ({
    color: colors[i % colors.length],
    translateX: getSignedUnit(seed * (i + 1), POSITION_RANGE / 2, 1),
    translateY: getSignedUnit(seed * (i + 1), POSITION_RANGE / 2, 2)
  }))
}

export function MarbleAvatar({
  name,
  size = 32,
  colors = DEFAULT_COLORS,
  variant = 'circle',
  className
}: MarbleAvatarProps) {
  const blobs = generateBlobs(name, colors)
  const seedSuffix = hashCode(name)
  const maskId = `marble-mask-${seedSuffix}`
  const filterId = `marble-filter-${seedSuffix}`
  const cornerRadius = variant === 'circle' ? SIZE * 2 : SIZE / 8
  const baseColor = colors[seedSuffix % colors.length]
  return (
    <svg
      className={cn('shrink-0', className)}
      fill="none"
      height={size}
      role="img"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{name}</title>
      <mask height={SIZE} id={maskId} maskUnits="userSpaceOnUse" width={SIZE} x={0} y={0}>
        <rect fill="#FFFFFF" height={SIZE} rx={cornerRadius} width={SIZE} />
      </mask>
      <g mask={`url(#${maskId})`}>
        <rect fill={baseColor} height={SIZE} width={SIZE} />
        <g filter={`url(#${filterId})`}>
          {blobs.map((blob, i) => (
            <circle
              cx={ANCHORS[i].cx + blob.translateX}
              cy={ANCHORS[i].cy + blob.translateY}
              fill={blob.color}
              key={`${blob.color}-${i}`}
              r={BLOB_RADIUS}
            />
          ))}
        </g>
      </g>
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          height={SIZE + FILTER_PADDING * 2}
          id={filterId}
          width={SIZE + FILTER_PADDING * 2}
          x={-FILTER_PADDING}
          y={-FILTER_PADDING}
        >
          <feGaussianBlur result="blur" stdDeviation={BLUR_STD_DEVIATION} />
        </filter>
      </defs>
    </svg>
  )
}
