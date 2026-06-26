import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { extractTextFromBuffer, parseOcrText } from '@/services/ocr'
import { uploadFile } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const mimeType = file.type

    const storagePath = `ocr/${Date.now()}-${file.name.replace(/\s/g, '_')}`
    let publicUrl = ''
    try {
      publicUrl = await uploadFile(buffer, storagePath, file.type)
    } catch (e) {
      console.warn('Storage upload failed:', e)
    }

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
      const rawText = await extractTextFromBuffer(buffer, mimeType)
      const extractedData = parseOcrText(rawText)

      // ── DEBUG: log first 3000 chars of raw text so we can see exactly
      //          what Vision returned and tune regex patterns to match it
      console.log('=== OCR RAW TEXT (first 3000 chars) ===')
      console.log(rawText.slice(0, 3000))
      console.log('=== OCR EXTRACTED ===')
      console.log(JSON.stringify(extractedData, null, 2))

      await prisma.ocrJob.update({
        where: { id: job.id },
        data: {
          status: 'REVIEW',
          rawText,
          // Return rawText in extractedData temporarily so we can see it in the UI
          extractedData: {
            ...extractedData,
            _debug_rawText: rawText.slice(0, 2000),
          },
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        jobId: job.id,
        extractedData,
        rawText,
        // Return raw text so we can inspect it
        _debug: rawText.slice(0, 2000),
      })
    } catch (ocrErr) {
      await prisma.ocrJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: String(ocrErr) },
      })
      return NextResponse.json({ error: 'OCR failed: ' + String(ocrErr) }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')

    if (jobId) {
      const job = await prisma.ocrJob.findUnique({ where: { id: jobId } })
      return NextResponse.json(job)
    }

    const jobs = await prisma.ocrJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(jobs)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
