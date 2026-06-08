import { QRCode as _QRCode } from 'react-qrcode-logo'
import logo from '@/assets/bark-wallet-logo.svg'

interface QRCodeProps {
  value: string
}

export function QRCode({ value }: QRCodeProps) {
  return (
    <_QRCode
      ecLevel="L"
      logoHeight={32}
      logoImage={logo}
      logoPadding={4}
      logoWidth={32}
      quietZone={16}
      removeQrCodeBehindLogo
      size={300}
      value={value}
    />
  )
}
