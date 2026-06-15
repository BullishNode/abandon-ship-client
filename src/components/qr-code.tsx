import { QRCode as _QRCode } from 'react-qrcode-logo'
import { useResolvedTheme } from '@/hooks/use-resolved-theme'
import { darkLogo, lightLogo } from '@/lib/qr-logo'

const DARK_MODULE_COLOR = '#ffffff'
const LIGHT_MODULE_COLOR = '#000000'

interface QRCodeProps {
  value: string
}

export function QRCode({ value }: QRCodeProps) {
  const resolvedTheme = useResolvedTheme()
  const isDark = resolvedTheme === 'dark'
  const fgColor = isDark ? DARK_MODULE_COLOR : LIGHT_MODULE_COLOR
  const logoImage = isDark ? darkLogo : lightLogo
  return (
    <_QRCode
      bgColor="transparent"
      ecLevel="L"
      fgColor={fgColor}
      logoHeight={32}
      logoImage={logoImage}
      logoPadding={4}
      logoWidth={32}
      quietZone={16}
      removeQrCodeBehindLogo
      size={300}
      value={value}
    />
  )
}
