import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.ocrJob.findUnique({
      where: { id: jobId },
      include: { student: { select: { id: true, studentName: true } } },
    })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(job)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const job = await prisma.ocrJob.update({
      where: { id: jobId },
      data: {
        status: body.status,
        studentId: body.studentId,
        extractedData: body.extractedData,
      },
    })
    return NextResponse.json(job)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
