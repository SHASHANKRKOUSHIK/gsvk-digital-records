import path from 'path'
import type { StudentFormData } from '@/types'

/**
 * Free, local OCR using Tesseract.js — no API key, no billing required.
 * Runs entirely on your local machine.
 *
 * NOTE: OCR is disabled on the live Vercel deployment (set OCR_DISABLED=1
 * in Vercel env vars) because Tesseract.js needs filesystem access to load
 * its WASM binary and language data, which Vercel's read-only serverless
 * functions don't support. This file is only executed locally.
 *
 * WINDOWS + Next.js webpack workaround:
 * We use path.join(process.cwd(), 'node_modules', ...) instead of
 * require.resolve() because webpack statically rewrites require.resolve()
 * calls at build time into bare unresolved strings, causing ERR_WORKER_PATH
 * when Node's worker_threads tries to spawn the Tesseract worker.
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
  const fullText = lines.join(' ')

  const patterns: Record<string, RegExp[]> = {
    // ── Original fields ──────────────────────────────────────────────────────
    studentName: [
      /student['s\s]*\s*name\s*[:\-]?\s*([A-Za-z\s]{3,40})/i,
      /name\s*of\s*(?:the\s*)?student\s*[:\-]?\s*([A-Za-z\s]{3,40})/i,
      /(?:^|\s)name\s*[:\-]\s*([A-Za-z\s]{3,40})/i,
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
      /father['s\s]*\s*name\s*[:\-]?\s*([A-Za-z\s]{3,40})/i,
      /father\s*[:\-]\s*([A-Za-z\s]{3,40})/i,
    ],
    motherName: [
      /mother['s\s]*\s*name\s*[:\-]?\s*([A-Za-z\s]{3,40})/i,
      /mother\s*[:\-]\s*([A-Za-z\s]{3,40})/i,
    ],
    phone: [
      /(?:phone|mobile|contact|tel)\s*(?:no|number)?\.?\s*[:\-]?\s*(\d{10})/i,
      /(\+91[\s\-]?\d{10})/,
      /(\d{10})/,
    ],
    className: [
      /class\s*[:\-]?\s*([A-Za-z0-9]+)/i,
      /std\.?\s*[:\-]?\s*([A-Za-z0-9]+)/i,
      /standard\s*[:\-]?\s*([A-Za-z0-9]+)/i,
    ],
    section: [
      /section\s*[:\-]?\s*([A-Za-z])\b/i,
      /div(?:ision)?\s*[:\-]?\s*([A-Za-z])\b/i,
    ],
    aadharNumber: [
      /aadhar\s*(?:no|number|card)?\.?\s*[:\-]?\s*(\d{4}\s?\d{4}\s?\d{4})/i,
      /aadhaar\s*(?:no|number)?\.?\s*[:\-]?\s*(\d{4}\s?\d{4}\s?\d{4})/i,
      /uid\s*[:\-]?\s*(\d{12})/i,
    ],
    address: [
      /present\s*(?:postal\s*)?address\s*[:\-]?\s*(.{10,120})/i,
      /(?:^|\s)address\s*[:\-]?\s*(.{10,120})/i,
    ],
    religion: [
      /religion\s*[:\-]?\s*([A-Za-z]+)/i,
    ],
    gender: [
      /(?:sex|gender)\s*[:\-]?\s*(male|female|m|f)\b/i,
    ],
    bloodGroup: [
      /blood\s*(?:group|type)\s*[:\-]?\s*([ABO]{1,2}[+-])/i,
      /b\.?\s*g(?:roup)?\s*[:\-]?\s*([ABO]{1,2}[+-])/i,
    ],
    academicYear: [
      /academic\s*year\s*[:\-]?\s*(\d{4}[\-\/]\d{2,4})/i,
      /session\s*[:\-]?\s*(\d{4}[\-\/]\d{2,4})/i,
      /year\s*[:\-]?\s*(\d{4}[\-\/]\d{2,4})/i,
    ],

    // ── New fields ────────────────────────────────────────────────────────────
    placeOfBirth: [
      /place\s*of\s*birth\s*[:\-]?\s*([A-Za-z\s,\.]{3,60})/i,
      /birth\s*place\s*[:\-]?\s*([A-Za-z\s,\.]{3,60})/i,
      /p\.?\s*o\.?\s*b\.?\s*[:\-]?\s*([A-Za-z\s,\.]{3,60})/i,
    ],
    motherTongue: [
      /mother\s*tongue\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
      /native\s*language\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
      /m\.?\s*t\.?\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    ],
    siblings: [
      /siblings?\s*[:\-]?\s*(.{2,60})/i,
      /no\.?\s*of\s*siblings?\s*[:\-]?\s*(\d+)/i,
      /brothers?\s*(?:and|&)\s*sisters?\s*[:\-]?\s*(.{2,40})/i,
    ],
    penNumber: [
      /p\.?\s*e\.?\s*n\.?\s*(?:no|number)?\.?\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
      /permanent\s*education\s*(?:no|number)\.?\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
      /pen\s*[:\-]\s*([A-Z0-9]{6,20})/i,
    ],
    satsNumber: [
      /s\.?\s*a\.?\s*t\.?\s*s\.?\s*(?:no|number)?\.?\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
      /sats\s*[:\-]\s*([A-Z0-9]{6,20})/i,
    ],
    apaarId: [
      /apaar\s*(?:id|no|number)?\.?\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
      /a\.?\s*p\.?\s*a\.?\s*a\.?\s*r\.?\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
      /abc\s*id\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
    ],
    annualIncome: [
      /annual\s*income\s*[:\-]?\s*([\d,\s\.]+)/i,
      /family\s*(?:annual\s*)?income\s*[:\-]?\s*([\d,\s\.]+)/i,
      /income\s*(?:per\s*annum|p\.?\s*a\.?)?\s*[:\-]?\s*([\d,\s\.]+)/i,
      /yearly\s*income\s*[:\-]?\s*([\d,\s\.]+)/i,
    ],
    permanentAddress: [
      /permanent\s*(?:postal\s*)?address\s*[:\-]?\s*(.{10,120})/i,
      /perm(?:anent)?\s*addr(?:ess)?\s*[:\-]?\s*(.{10,120})/i,
    ],
  }

  for (const [field, regexList] of Object.entries(patterns)) {
    for (const regex of regexList) {
      const match = fullText.match(regex)
      if (match?.[1]) {
        let value = match[1].trim()

        // Field-specific post-processing
        if (field === 'gender') {
          value = value.toLowerCase().startsWith('f') ? 'FEMALE' : 'MALE'
        } else if (field === 'bloodGroup') {
          const bgMap: Record<string, string> = {
            'A+': 'A_POS', 'A-': 'A_NEG', 'B+': 'B_POS', 'B-': 'B_NEG',
            'AB+': 'AB_POS', 'AB-': 'AB_NEG', 'O+': 'O_POS', 'O-': 'O_NEG',
          }
          value = bgMap[value] || 'UNKNOWN'
        } else if (field === 'dateOfBirth' || field === 'admissionDate') {
          const parsed = parseDate(value)
          if (parsed) value = parsed
          else continue
        } else if (field === 'aadharNumber') {
          value = value.replace(/\s/g, '')
          if (value.length !== 12) continue
        } else if (field === 'phone') {
          value = value.replace(/\D/g, '').slice(-10)
          if (value.length !== 10) continue
        } else if (field === 'annualIncome') {
          // Strip trailing text like "per year", "p.a." etc.
          value = value.replace(/\s*(per|p\.a|annum|year|lakh|lac).*/i, '').trim()
        } else if (
          field === 'studentName' || field === 'fatherName' ||
          field === 'motherName' || field === 'placeOfBirth' ||
          field === 'motherTongue'
        ) {
          // Strip common trailing OCR junk after names
          value = value
            .replace(/\s*(s\/o|d\/o|w\/o|c\/o|class|std|section|dob|adm|no|roll)\s*$/i, '')
            .trim()
          if (value.length < 3) continue
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
