import QRCode from 'qrcode'
import { getProfileUrl } from '@/lib/utils'

export async function generateQRCode(studentId: string): Promise<string> {
  const url = getProfileUrl(studentId)
  return QRCode.toDataURL(url, {
    width: 200,
    margin: 2,
    color: { dark: '#1E40AF', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })
}

export async function generateQRCodeSVG(studentId: string): Promise<string> {
  const url = getProfileUrl(studentId)
  return QRCode.toString(url, { type: 'svg', width: 200 })
}
