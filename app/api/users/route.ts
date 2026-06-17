import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireSuperAdmin()
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(users)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 403 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin()
    const { name, email, role } = await req.json()
    if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

    const user = await prisma.user.create({
      data: { name, email, role: role || 'DATA_ENTRY_OPERATOR' },
    })
    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    if (String(err).includes('Unique constraint')) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
