import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { deleteFile } from '@/lib/supabase'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Try to delete from storage
    try {
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'gsvk-documents'
      const path = doc.storagePath.split(`${bucket}/`)[1]
      if (path) await deleteFile(path)
    } catch (e) {
      console.warn('Storage delete failed:', e)
    }

    await prisma.document.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        studentId: doc.studentId,
        action: 'DELETE',
        entity: 'Document',
        entityId: id,
        oldData: { originalName: doc.originalName, documentType: doc.documentType },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
