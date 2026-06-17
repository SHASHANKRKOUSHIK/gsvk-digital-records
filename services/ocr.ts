import path from 'path'
import type { StudentFormData } from '@/types'

/**
 * Free, local OCR using Tesseract.js.
 *
 * IMPORTANT (Windows + Next.js dev server / webpack):
 * Tesseract.js's node worker is spawned via `new Worker(workerPath)` from
 * worker_threads, using a path it computes from its own __dirname. When our
 * code is compiled by webpack (which Next.js does even for "external"
 * server packages, since our *own* file is still bundled), any
 * `require.resolve('tesseract.js/...')` call gets statically rewritten by
 * webpack into the literal unresolved string — not an actual resolved path.
 * That string then gets passed to `new Worker(...)`, which throws
 * ERR_WORKER_PATH because it isn't a real path.
 *
 * Fix: build the absolute path manually at runtime using
 * `path.join(process.cwd(), 'node_modules', ...)`, which webpack does not
 * statically rewrite (since it can't know the file ahead of time — it's a
 * pure runtime string concatenation, not a require/import call).
 */
function getTesseractWorkerPath(): string {
  return path.join(
    process.cwd(),
    'node_modules',
    'tesseract.js',
    'src',
    'worker-script',
    'node',
    'index.js'
  )
}

export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Tesseract = require('tesseract.js')

  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: getTesseractWorkerPath(),
  })

  try {
    const { data } = await worker.recognize(buffer)
    return data.text || ''
  } finally {
    await worker.terminate()
  }
}

export async function extractTextFromBase64(base64: string, _mimeType: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64')
  return extractTextFromBuffer(buffer)
}

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return extractTextFromBuffer(buffer)
}

export function parseOcrText(text: string): Partial<StudentFormData> {
  const extracted: Partial<StudentFormData> = {}
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const patterns: Record<string, RegExp[]> = {
    studentName: [
      /student['\s]?s?\s*name\s*[:\-]?\s*([A-Za-z\s]+)/i,
      /name\s*of\s*student\s*[:\-]?\s*([A-Za-z\s]+)/i,
      /name\s*[:\-]\s*([A-Za-z\s]{3,40})/i,
    ],
    admissionNumber: [
      /admission\s*(?:no|number|#)\.?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
      /adm\.?\s*no\.?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
    ],
    dateOfBirth: [
      /(?:date\s*of\s*birth|dob|d\.o\.b)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    admissionDate: [
      /admission\s*date\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    fatherName: [
      /father['\s]?s?\s*name\s*[:\-]?\s*([A-Za-z\s]+)/i,
      /father\s*[:\-]\s*([A-Za-z\s]{3,40})/i,
    ],
    motherName: [
      /mother['\s]?s?\s*name\s*[:\-]?\s*([A-Za-z\s]+)/i,
      /mother\s*[:\-]\s*([A-Za-z\s]{3,40})/i,
    ],
    phone: [
      /(?:phone|mobile|contact|tel)\s*(?:no|number)?\.?\s*[:\-]?\s*(\d{10})/i,
      /(\d{10})/,
    ],
    className: [
      /class\s*[:\-]?\s*([A-Za-z0-9]+)/i,
      /std\.?\s*[:\-]?\s*([A-Za-z0-9]+)/i,
    ],
    section: [
      /section\s*[:\-]?\s*([A-Za-z])/i,
      /div(?:ision)?\s*[:\-]?\s*([A-Za-z])/i,
    ],
    aadharNumber: [
      /aadhar\s*(?:no|number|card)?\.?\s*[:\-]?\s*(\d{4}\s?\d{4}\s?\d{4})/i,
      /uid\s*[:\-]?\s*(\d{12})/i,
    ],
    address: [
      /address\s*[:\-]?\s*(.{10,100})/i,
    ],
    religion: [
      /religion\s*[:\-]?\s*([A-Za-z]+)/i,
    ],
    gender: [
      /(?:sex|gender)\s*[:\-]?\s*(male|female|m|f)/i,
    ],
    bloodGroup: [
      /blood\s*(?:group|type)\s*[:\-]?\s*([ABO]{1,2}[+-])/i,
    ],
    academicYear: [
      /academic\s*year\s*[:\-]?\s*(\d{4}[\-\/]\d{2,4})/i,
      /session\s*[:\-]?\s*(\d{4}[\-\/]\d{2,4})/i,
    ],
  }

  const fullText = lines.join(' ')

  for (const [field, regexList] of Object.entries(patterns)) {
    for (const regex of regexList) {
      const match = fullText.match(regex)
      if (match?.[1]) {
        let value = match[1].trim()

        if (field === 'gender') {
          value = value.toLowerCase().startsWith('f') ? 'FEMALE' : 'MALE'
        } else if (field === 'bloodGroup') {
          const bgMap: Record<string, string> = {
            'A+': 'A_POS', 'A-': 'A_NEG', 'B+': 'B_POS', 'B-': 'B_NEG',
            'AB+': 'AB_POS', 'AB-': 'AB_NEG', 'O+': 'O_POS', 'O-': 'O_NEG'
          }
          value = bgMap[value] || 'UNKNOWN'
        } else if (field === 'dateOfBirth' || field === 'admissionDate') {
          const parsed = parseDate(value)
          if (parsed) value = parsed
        } else if (field === 'aadharNumber') {
          value = value.replace(/\s/g, '')
        }

        ;(extracted as Record<string, string>)[field] = value
        break
      }
    }
  }

  return extracted
}

function parseDate(dateStr: string): string | null {
  const parts = dateStr.split(/[\/\-\.]/)
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const year = y.length === 2 ? `20${y}` : y
  try {
    const date = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    return isNaN(date.getTime()) ? null : date.toISOString()
  } catch {
    return null
  }
}
