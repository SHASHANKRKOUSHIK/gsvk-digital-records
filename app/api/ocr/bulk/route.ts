import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { extractTextFromBuffer, parseOcrText } from '@/services/ocr'
import { uploadFile } from '@/lib/supabase'

// See app/api/ocr/route.ts for full explanation of why this flag exists
// (Tesseract.js needs filesystem access that Vercel's serverless functions
// don't provide). Set OCR_DISABLED=1 in Vercel's environment variables.
const OCR_DISABLED = process.env.OCR_DISABLED === '1'

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (OCR_DISABLED) {
      return NextResponse.json(
        {
          error: 'OCR is only available when running this app locally on your own computer, not on the live deployed site.',
          ocrUnavailable: true,
        },
        { status: 501 }
      )
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

    const results = []

    for (const file of files) {
      try {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const storagePath = `bulk-ocr/${Date.now()}-${file.name.replace(/\s/g, '_')}`
        let publicUrl = ''
        try {
          publicUrl = await uploadFile(buffer, storagePath, file.type)
        } catch {}

        const job = await prisma.ocrJob.create({
          data: {
            userId: user.id,
            status: 'PROCESSING',
            fileName: file.name,
            storagePath: publicUrl || storagePath,
            startedAt: new Date(),
          },
        })

        try {
          const rawText = await extractTextFromBuffer(buffer)
          const extractedData = parseOcrText(rawText)

          await prisma.ocrJob.update({
            where: { id: job.id },
            data: { status: 'REVIEW', rawText, extractedData, completedAt: new Date() },
          })

          results.push({ jobId: job.id, fileName: file.name, status: 'REVIEW', extractedData })
        } catch (ocrErr) {
          await prisma.ocrJob.update({
            where: { id: job.id },
            data: { status: 'FAILED', errorMessage: String(ocrErr) },
          })
          results.push({ jobId: job.id, fileName: file.name, status: 'FAILED', error: String(ocrErr) })
        }
      } catch (fileErr) {
        results.push({ fileName: file.name, status: 'FAILED', error: String(fileErr) })
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
