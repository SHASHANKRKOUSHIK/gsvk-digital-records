import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { extractTextFromBuffer, parseOcrText } from '@/services/ocr'
import { uploadFile } from '@/lib/supabase'

// Tesseract.js requires filesystem access to load its WASM binary and
// language data, which Vercel's serverless functions don't support (the
// deployment package is read-only). OCR is therefore only available when
// running locally (npm run dev / npm start on your own machine).
//
// We use our own explicit OCR_DISABLED flag rather than detecting Vercel
// automatically (e.g. via process.env.VERCEL), because that system variable
// is only populated when "Enable access to System Environment Variables" is
// checked in the Vercel project settings - relying on it could silently fail
// to disable OCR and bring back the same WASM crash. Setting OCR_DISABLED=1
// in Vercel's environment variables guarantees this works regardless of that
// setting, and lets you manually re-enable OCR later (e.g. after switching
// to Google Vision API) just by removing the variable.
const OCR_DISABLED = process.env.OCR_DISABLED === '1'

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (OCR_DISABLED) {
      return NextResponse.json(
        {
          error: 'OCR is only available when running this app locally on your own computer, not on the live deployed site. Please use manual entry instead, or run the app locally for OCR uploads.',
          ocrUnavailable: true,
        },
        { status: 501 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload original to storage (optional — continues even if this fails)
    const storagePath = `ocr/${Date.now()}-${file.name.replace(/\s/g, '_')}`
    let publicUrl = ''
    try {
      publicUrl = await uploadFile(buffer, storagePath, file.type)
    } catch (e) {
      console.warn('Storage upload failed, continuing with OCR:', e)
    }

    // Create OCR job
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
        data: {
          status: 'REVIEW',
          rawText,
          extractedData,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({ jobId: job.id, extractedData, rawText })
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
