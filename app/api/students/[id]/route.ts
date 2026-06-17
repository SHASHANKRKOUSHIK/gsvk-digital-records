import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parents: true,
        documents: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { name: true, email: true } } },
        },
      },
    })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(student)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      fatherName, motherName, guardianName, phone, alternatePhone,
      email, address, city, district, state, pincode, occupation,
      ...studentData
    } = body

    const old = await prisma.student.findUnique({ where: { id } })

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...studentData,
        admissionDate: new Date(studentData.admissionDate),
        dateOfBirth: new Date(studentData.dateOfBirth),
      },
    })

    // Update or create parent
    const existingParent = await prisma.parent.findFirst({ where: { studentId: id } })
    if (existingParent) {
      await prisma.parent.update({
        where: { id: existingParent.id },
        data: { fatherName, motherName, guardianName, phone, alternatePhone, email, address, city, district, state, pincode, occupation },
      })
    } else {
      await prisma.parent.create({
        data: { studentId: id, fatherName, motherName, guardianName, phone, alternatePhone, email, address, city, district, state, pincode, occupation },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        studentId: id,
        action: 'UPDATE',
        entity: 'Student',
        entityId: id,
        oldData: old as Record<string, unknown>,
        newData: body,
      },
    })

    return NextResponse.json({ id: student.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.student.update({ where: { id }, data: { isActive: false } })
    await prisma.auditLog.create({
      data: { userId: user.id, studentId: id, action: 'DELETE', entity: 'Student', entityId: id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
