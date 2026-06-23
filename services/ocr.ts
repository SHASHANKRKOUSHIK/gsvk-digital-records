import type { StudentFormData } from '@/types'

/**
 * Google Cloud Vision API — OCR for admission forms.
 *
 * For images (JPG, PNG, WebP): uses images:annotate with TEXT_DETECTION.
 * For PDFs: uses files:annotate with DOCUMENT_TEXT_DETECTION which handles
 * PDFs natively (up to 5 pages) without needing image conversion.
 *
 * Works on both local dev AND live Vercel — pure HTTPS, no filesystem needed.
 */

const VISION_BASE = 'https://vision.googleapis.com/v1'

function getApiKey(): string {
  const key = process.env.GOOGLE_VISION_API_KEY
  if (!key) throw new Error('GOOGLE_VISION_API_KEY environment variable is not set')
  return key
}

/**
 * Detect whether a buffer is a PDF by checking its magic bytes (%PDF header).
 */
function isPdf(buffer: Buffer): boolean {
  return buffer.slice(0, 4).toString('ascii') === '%PDF'
}

/**
 * Extract text from a PDF buffer using Vision's files:annotate endpoint,
 * which handles PDFs natively (no image conversion needed).
 */
async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const apiKey = getApiKey()
  const base64 = buffer.toString('base64')

  const response = await fetch(`${VISION_BASE}/files:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          inputConfig: {
            content: base64,
            mimeType: 'application/pdf',
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          pages: [1, 2, 3, 4, 5], // process up to 5 pages
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Vision API HTTP error ${response.status}: ${text}`)
  }

  const data = await response.json()

  if (data.error) throw new Error(`Vision API error: ${data.error.message}`)

  const result = data.responses?.[0]
  if (result?.error) throw new Error(`Vision API request error: ${result.error.message}`)

  // For files:annotate the text is in responses[0].responses[0].fullTextAnnotation.text
  const pages = result?.responses || []
  return pages
    .map((p: { fullTextAnnotation?: { text?: string } }) => p.fullTextAnnotation?.text || '')
    .join('\n')
}

/**
 * Extract text from an image buffer using Vision's images:annotate endpoint.
 */
async function extractTextFromImageBuffer(buffer: Buffer, mimeType?: string): Promise<string> {
  const apiKey = getApiKey()
  const base64 = buffer.toString('base64')

  const response = await fetch(`${VISION_BASE}/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['en', 'hi'] },
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Vision API HTTP error ${response.status}: ${text}`)
  }

  const data = await response.json()

  if (data.error) throw new Error(`Vision API error: ${data.error.message}`)

  const result = data.responses?.[0]
  if (result?.error) throw new Error(`Vision API request error: ${result.error.message}`)

  // DOCUMENT_TEXT_DETECTION returns the full text in fullTextAnnotation.text
  return result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || ''
}

/**
 * Main entry point — automatically detects PDF vs image and routes accordingly.
 */
export async function extractTextFromBuffer(buffer: Buffer, mimeType?: string): Promise<string> {
  if (isPdf(buffer) || mimeType === 'application/pdf') {
    return extractTextFromPdfBuffer(buffer)
  }
  return extractTextFromImageBuffer(buffer, mimeType)
}

export async function extractTextFromBase64(base64: string, mimeType: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64')
  return extractTextFromBuffer(buffer, mimeType)
}

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  const contentType = res.headers.get('content-type') || undefined
  const arrayBuffer = await res.arrayBuffer()
  return extractTextFromBuffer(Buffer.from(arrayBuffer), contentType || undefined)
}

/**
 * Parse the raw OCR text into structured student form fields.
 */
export function parseOcrText(text: string): Partial<StudentFormData> {
  const extracted: Partial<StudentFormData> = {}
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const fullText = lines.join(' ')

  const patterns: Record<string, RegExp[]> = {
    studentName: [
      /student['s\s]*\s*name\s*[:\-]?\s*([A-Za-z\s]{3,40})/i,
      /name\s*of\s*(?:the\s*)?student\s*[:\-]?\s*([A-Za-z\s]{3,40})/i,
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
    ],
    section: [
      /section\s*[:\-]?\s*([A-Za-z])\b/i,
    ],
    aadharNumber: [
      /aadhar\s*(?:no|number|card)?\.?\s*[:\-]?\s*(\d{4}\s?\d{4}\s?\d{4})/i,
      /aadhaar\s*(?:no|number)?\.?\s*[:\-]?\s*(\d{4}\s?\d{4}\s?\d{4})/i,
    ],
    address: [
      /present\s*(?:postal\s*)?address\s*[:\-]?\s*(.{10,120})/i,
      /(?:^|\s)address\s*[:\-]?\s*(.{10,120})/i,
    ],
    religion: [/religion\s*[:\-]?\s*([A-Za-z]+)/i],
    gender: [/(?:sex|gender)\s*[:\-]?\s*(male|female|m|f)\b/i],
    bloodGroup: [
      /blood\s*(?:group|type)\s*[:\-]?\s*([ABO]{1,2}[+-])/i,
    ],
    academicYear: [
      /academic\s*year\s*[:\-]?\s*(\d{4}[\-\/]\d{2,4})/i,
      /session\s*[:\-]?\s*(\d{4}[\-\/]\d{2,4})/i,
    ],
    caste: [
      /caste\s*[:\-]?\s*([A-Za-z\s]{2,20})/i,
      /category\s*[:\-]?\s*(general|obc|sc|st|others?)\b/i,
    ],
    previousSchool: [
      /previous\s*school\s*[:\-]?\s*(.{5,80})/i,
    ],
    placeOfBirth: [
      /place\s*of\s*birth\s*[:\-]?\s*([A-Za-z\s,\.]{3,60})/i,
      /birth\s*place\s*[:\-]?\s*([A-Za-z\s,\.]{3,60})/i,
    ],
    motherTongue: [
      /mother\s*tongue\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
      /native\s*language\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    ],
    siblings: [
      /siblings?\s*[:\-]?\s*(.{2,60})/i,
      /no\.?\s*of\s*siblings?\s*[:\-]?\s*(\d+)/i,
    ],
    penNumber: [
      /p\.?\s*e\.?\s*n\.?\s*(?:no|number)?\.?\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
      /pen\s*[:\-]\s*([A-Z0-9]{6,20})/i,
    ],
    satsNumber: [
      /s\.?\s*a\.?\s*t\.?\s*s\.?\s*(?:no|number)?\.?\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
      /sats\s*[:\-]\s*([A-Z0-9]{6,20})/i,
    ],
    apaarId: [
      /apaar\s*(?:id|no|number)?\.?\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
      /abc\s*id\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
    ],
    annualIncome: [
      /annual\s*income\s*[:\-]?\s*((?:Rs\.?\s*)?[\d,\s\.]+)/i,
      /income\s*(?:per\s*annum|p\.?\s*a\.?)?\s*[:\-]?\s*((?:Rs\.?\s*)?[\d,\s\.]+)/i,
    ],
    permanentAddress: [
      /permanent\s*(?:postal\s*)?address\s*[:\-]?\s*(.{10,120})/i,
    ],
    occupation: [
      /(?:father['s\s]*)?occupation\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    ],
    tcNumber: [
      /t\.?\s*c\.?\s*(?:no|number)?\s*[:\-]?\s*([A-Z0-9\-]{4,20})/i,
      /transfer\s*cert(?:ificate)?\s*(?:no|number)?\s*[:\-]?\s*([A-Z0-9\-]{4,20})/i,
    ],
  }

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
          value = value.replace(/\s*(per|p\.a|annum|year|lakh|lac).*/i, '').trim()
        } else if (
          field === 'studentName' || field === 'fatherName' ||
          field === 'motherName' || field === 'placeOfBirth' ||
          field === 'motherTongue'
        ) {
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
