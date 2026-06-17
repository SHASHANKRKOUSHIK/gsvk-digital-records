import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { generateClassWiseExcel, generateYearWiseExcel, generateCombinedExcel } from '@/services/excel'
import { bufferToArrayBuffer } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { type, className, year, filters } = await req.json()

    const where: Record<string, unknown> = { isActive: true }
    if (filters?.className) where.className = filters.className
    if (filters?.year) where.academicYear = filters.year

    const students = await prisma.student.findMany({
      where,
      orderBy: [{ className: 'asc' }, { studentName: 'asc' }],
      include: { parents: { take: 1 } },
    })

    let buffer: Buffer
    let filename: string
    let exportType: string

    if (type === 'class' && className) {
      const filtered = students.filter(s => s.className === className)
      buffer = await generateClassWiseExcel(filtered as never, className)
      filename = `Class_${className}_${Date.now()}.xlsx`
      exportType = 'CLASS'
    } else if (type === 'year' && year) {
      const filtered = students.filter(s => s.academicYear === year)
      buffer = await generateYearWiseExcel(filtered as never, year)
      filename = `Year_${year.replace('/', '-')}_${Date.now()}.xlsx`
      exportType = 'YEAR'
    } else {
      buffer = await generateCombinedExcel(students as never)
      filename = `All_Students_${Date.now()}.xlsx`
      exportType = 'COMBINED'
    }

    // Log the export
    await prisma.export.create({
      data: {
        userId: user.id,
        exportType,
        fileName: filename,
        storagePath: filename,
        filters: filters || null,
        rowCount: students.length,
        fileSize: buffer.length,
      },
    })

    return new NextResponse(bufferToArrayBuffer(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
