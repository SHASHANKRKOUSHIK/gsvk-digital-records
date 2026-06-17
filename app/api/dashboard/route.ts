import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [total, byYear, byClass, ocrStats] = await Promise.all([
      prisma.student.count({ where: { isActive: true } }),
      prisma.student.groupBy({ by: ['academicYear'], _count: { id: true }, orderBy: { academicYear: 'asc' } }),
      prisma.student.groupBy({ by: ['className'], _count: { id: true }, orderBy: { className: 'asc' } }),
      prisma.ocrJob.groupBy({ by: ['status'], _count: { id: true } }),
    ])

    return NextResponse.json({ total, byYear, byClass, ocrStats })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
