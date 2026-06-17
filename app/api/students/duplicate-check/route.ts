import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { studentName, dateOfBirth, fatherName, phone } = await req.json()

    const conditions = []

    if (studentName && dateOfBirth) {
      conditions.push({
        studentName: { equals: studentName, mode: 'insensitive' as const },
        dateOfBirth: new Date(dateOfBirth),
      })
    }

    if (fatherName && studentName) {
      conditions.push({
        studentName: { equals: studentName, mode: 'insensitive' as const },
        parents: { some: { fatherName: { equals: fatherName, mode: 'insensitive' as const } } },
      })
    }

    if (phone) {
      conditions.push({ parents: { some: { phone: { equals: phone } } } })
    }

    if (conditions.length === 0) return NextResponse.json({ duplicate: null })

    const existing = await prisma.student.findFirst({
      where: { OR: conditions, isActive: true },
      select: { id: true, studentName: true, admissionNumber: true },
    })

    if (existing) {
      return NextResponse.json({ duplicate: { id: existing.id, name: existing.studentName } })
    }

    return NextResponse.json({ duplicate: null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
