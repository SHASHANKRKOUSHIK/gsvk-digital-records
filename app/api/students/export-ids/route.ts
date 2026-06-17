import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const students = await prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, studentName: true, admissionNumber: true, className: true, academicYear: true },
      orderBy: [{ academicYear: 'desc' }, { studentName: 'asc' }],
    })

    return NextResponse.json(students)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
