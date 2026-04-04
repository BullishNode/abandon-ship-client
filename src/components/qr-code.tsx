import { QRCode as _QRCode } from 'react-qrcode-logo'

interface QRCodeProps {
  value: string
}

export function QRCode({ value }: QRCodeProps) {
  return (
    <_QRCode
      logoImage="/favicon.png"
      logoPadding={4}
      logoPaddingRadius={8}
      logoWidth={32}
      size={300}
      value={value}
    />
  )
}
