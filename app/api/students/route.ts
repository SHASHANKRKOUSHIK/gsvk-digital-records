import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { generateQRCode } from '@/services/qrcode'

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const q = searchParams.get('q')
    const className = searchParams.get('class')
    const year = searchParams.get('year')

    const where: Record<string, unknown> = {}
    if (className) where.className = className
    if (year) where.academicYear = year
    if (q) {
      where.OR = [
        { studentName: { contains: q, mode: 'insensitive' } },
        { admissionNumber: { contains: q, mode: 'insensitive' } },
        { aadharNumber: { contains: q } },
        { parents: { some: { fatherName: { contains: q, mode: 'insensitive' } } } },
        { parents: { some: { motherName: { contains: q, mode: 'insensitive' } } } },
        { parents: { some: { phone: { contains: q } } } },
      ]
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { parents: { take: 1 } },
      }),
      prisma.student.count({ where }),
    ])

    return NextResponse.json({ data: students, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      fatherName, motherName, guardianName, phone, alternatePhone,
      email, address, city, district, state, pincode, occupation,
      ...studentData
    } = body

    const student = await prisma.student.create({
      data: {
        ...studentData,
        admissionDate: new Date(studentData.admissionDate),
        dateOfBirth: new Date(studentData.dateOfBirth),
        parents: {
          create: [{
            fatherName, motherName, guardianName, phone, alternatePhone,
            email, address, city, district, state, pincode, occupation,
          }],
        },
      },
    })

    // Generate QR code
    try {
      const qr = await generateQRCode(student.id)
      await prisma.student.update({ where: { id: student.id }, data: { qrCode: qr } })
    } catch {}

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        studentId: student.id,
        action: 'CREATE',
        entity: 'Student',
        entityId: student.id,
        newData: body,
      },
    })

    return NextResponse.json({ id: student.id }, { status: 201 })
  } catch (err) {
    if (String(err).includes('Unique constraint')) {
      return NextResponse.json({ error: 'Admission number or Aadhar already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
