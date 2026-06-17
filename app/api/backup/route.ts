import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { type } = await req.json()

    // Export all students as JSON backup
    const students = await prisma.student.findMany({
      include: { parents: true, documents: true },
    })

    const backupData = JSON.stringify({ exportedAt: new Date().toISOString(), count: students.length, students }, null, 2)
    const backupSize = Buffer.byteLength(backupData, 'utf8')
    const fileName = `backup-${type || 'manual'}-${Date.now()}.json`

    // Try uploading to Supabase storage
    let storagePath = fileName
    try {
      const { uploadFile } = await import('@/lib/supabase')
      const buffer = Buffer.from(backupData)
      storagePath = await uploadFile(buffer, `backups/${fileName}`, 'application/json')
    } catch (e) {
      console.warn('Backup upload to storage failed:', e)
    }

    const backup = await prisma.backup.create({
      data: {
        backupType: type || 'MANUAL',
        storagePath,
        fileSize: backupSize,
        status: 'COMPLETED',
      },
    })

    return NextResponse.json({ id: backup.id, fileName, size: backupSize, count: students.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const backups = await prisma.backup.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
    return NextResponse.json(backups)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
