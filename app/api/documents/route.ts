import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { uploadFile } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const studentId = formData.get('studentId') as string
    const documentType = (formData.get('documentType') as string) || 'ADMISSION_FORM'

    if (!file || !studentId) return NextResponse.json({ error: 'File and studentId required' }, { status: 400 })

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const storagePath = `documents/${studentId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`

    const publicUrl = await uploadFile(buffer, storagePath, file.type)

    const document = await prisma.document.create({
      data: {
        studentId,
        documentType: documentType as never,
        originalName: file.name,
        storagePath: publicUrl,
        fileSize: file.size,
        mimeType: file.type,
      },
    })

    return NextResponse.json({ id: document.id, url: publicUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
