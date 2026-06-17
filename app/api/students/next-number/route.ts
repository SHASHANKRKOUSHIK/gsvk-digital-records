import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const yearPrefix = `ADM-${year}-`

    const last = await prisma.student.findFirst({
      where: { admissionNumber: { startsWith: yearPrefix } },
      orderBy: { admissionNumber: 'desc' },
      select: { admissionNumber: true },
    })

    let nextNum = 1
    if (last) {
      const parts = last.admissionNumber.split('-')
      const lastNum = parseInt(parts[parts.length - 1]) || 0
      nextNum = lastNum + 1
    }

    const nextNumber = `${yearPrefix}${String(nextNum).padStart(4, '0')}`
    return NextResponse.json({ admissionNumber: nextNumber })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
