import { useEffect, useState } from 'react'

function getDevice(): 'mobile' | 'tablet' | 'desktop' | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (window.matchMedia('(min-width: 1024px)').matches) {
    return 'desktop'
  }
  if (window.matchMedia('(min-width: 640px)').matches) {
    return 'tablet'
  }
  return 'mobile'
}

function getDimensions() {
  if (typeof window === 'undefined') {
    return null
  }

  return { height: window.innerHeight, width: window.innerWidth }
}

export function useMediaQuery() {
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop' | null>(() => getDevice())
  const [dimensions, setDimensions] = useState(() => getDimensions())

  useEffect(() => {
    function checkDevice() {
      setDevice(getDevice())
      setDimensions(getDimensions())
    }

    checkDevice()

    window.addEventListener('resize', checkDevice)

    return () => {
      window.removeEventListener('resize', checkDevice)
    }
  }, [])

  return {
    device,
    height: dimensions?.height,
    isDesktop: device === 'desktop',
    isMobile: device === 'mobile',
    isTablet: device === 'tablet',
    width: dimensions?.width
  }
}
