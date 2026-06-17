import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateQRCode } from '@/services/qrcode'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const student = await prisma.student.findUnique({ where: { id }, select: { id: true, qrCode: true } })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!student.qrCode) {
      const qr = await generateQRCode(id)
      await prisma.student.update({ where: { id }, data: { qrCode: qr } })
      return NextResponse.json({ qrCode: qr })
    }

    return NextResponse.json({ qrCode: student.qrCode })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const qr = await generateQRCode(id)
    await prisma.student.update({ where: { id }, data: { qrCode: qr } })
    return NextResponse.json({ qrCode: qr })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
