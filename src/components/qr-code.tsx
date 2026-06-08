import { QRCode as _QRCode } from 'react-qrcode-logo'

interface QRCodeProps {
  value: string
}

export function QRCode({ value }: QRCodeProps) {
  return (
    <_QRCode
      ecLevel="L"
      logoHeight={32}
      logoImage="/favicon.png"
      logoPadding={4}
      logoWidth={32}
      quietZone={16}
      removeQrCodeBehindLogo
      size={300}
      value={value}
    />
  )
}
