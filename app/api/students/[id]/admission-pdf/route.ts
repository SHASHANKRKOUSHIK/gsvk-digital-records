import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { uploadFile, deleteFile } from '@/lib/supabase'
import { PDFDocument } from 'pdf-lib'

/**
 * Compress a PDF buffer using pdf-lib.
 * For scanned form PDFs this typically achieves 20-40% size reduction by
 * re-serializing the PDF with compression flags enabled. pdf-lib doesn't
 * re-encode embedded images (which would require a heavier library), but
 * it does strip redundant metadata and optimize the object structure.
 */
async function compressPdf(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(inputBuffer, {
      ignoreEncryption: true,
    })
    const compressed = await pdfDoc.save({
      useObjectStreams: true,   // pack non-stream objects into compressed streams
      addDefaultPage: false,
      objectsPerTick: 50,
    })
    return Buffer.from(compressed)
  } catch (e) {
    // If pdf-lib can't parse it (e.g. corrupted/encrypted), return original
    console.warn('PDF compression failed, using original:', e)
    return inputBuffer
  }
}

/**
 * Build the Supabase storage path:
 * admission-forms/{academicYear}/{className}/{admissionNumber}_{studentName}.pdf
 *
 * Sanitises the path components so they're safe for storage keys.
 */
function buildStoragePath(student: {
  academicYear: string
  className: string
  admissionNumber: string
  studentName: string
}): string {
  const sanitise = (s: string) =>
    s.replace(/[^A-Za-z0-9\-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

  const year = sanitise(student.academicYear)      // e.g. 2024-25
  const cls  = sanitise(`Class-${student.className}`)  // e.g. Class-5
  const name = sanitise(student.studentName).slice(0, 30)
  const adm  = sanitise(student.admissionNumber)

  return `admission-forms/${year}/${cls}/${adm}_${name}.pdf`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const student = await prisma.student.findUnique({ where: { id } })
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })
    }

    // Delete old PDF if one exists (replace behaviour)
    if (student.admissionFormPdf) {
      try {
        await deleteFile(student.admissionFormPdf)
      } catch {
        // Non-fatal — old file might have been manually deleted
      }
    }

    // Read, compress, upload
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const compressed = await compressPdf(rawBuffer)
    const storagePath = buildStoragePath(student)
    const publicUrl = await uploadFile(compressed, storagePath, 'application/pdf')

    // Persist path + URL on the student record
    await prisma.student.update({
      where: { id },
      data: { admissionFormPdf: storagePath, admissionFormPdfUrl: publicUrl },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        studentId: id,
        action: 'UPLOAD_PDF',
        entity: 'Student',
        entityId: id,
        newData: { storagePath, fileSize: compressed.length, originalSize: rawBuffer.length },
      },
    })

    return NextResponse.json({
      success: true,
      storagePath,
      publicUrl,
      originalSize: rawBuffer.length,
      compressedSize: compressed.length,
      savedBytes: rawBuffer.length - compressed.length,
    })
  } catch (err) {
    console.error('Admission PDF upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const student = await prisma.student.findUnique({ where: { id } })
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    if (student.admissionFormPdf) {
      await deleteFile(student.admissionFormPdf)
    }

    await prisma.student.update({
      where: { id },
      data: { admissionFormPdf: null, admissionFormPdfUrl: null },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
