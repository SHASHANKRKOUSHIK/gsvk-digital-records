import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const className = searchParams.get('class') || ''
    const year = searchParams.get('year') || ''
    const gender = searchParams.get('gender') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20

    const where: Record<string, unknown> = { isActive: true }
    if (className) where.className = className
    if (year) where.academicYear = year
    if (gender) where.gender = gender

    if (q) {
      where.OR = [
        { studentName: { contains: q, mode: 'insensitive' } },
        { admissionNumber: { contains: q, mode: 'insensitive' } },
        { aadharNumber: { contains: q } },
        { parents: { some: { fatherName: { contains: q, mode: 'insensitive' } } } },
        { parents: { some: { motherName: { contains: q, mode: 'insensitive' } } } },
        { parents: { some: { phone: { contains: q } } } },
        { parents: { some: { email: { contains: q, mode: 'insensitive' } } } },
      ]
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { studentName: 'asc' },
        include: { parents: { take: 1 } },
      }),
      prisma.student.count({ where }),
    ])

    return NextResponse.json({ data: students, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
