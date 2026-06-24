import type { StudentFormData } from '@/types'

const VISION_BASE = 'https://vision.googleapis.com/v1'

function getApiKey(): string {
  const key = process.env.GOOGLE_VISION_API_KEY
  if (!key) throw new Error('GOOGLE_VISION_API_KEY environment variable is not set')
  return key
}

function isPdf(buffer: Buffer): boolean {
  return buffer.slice(0, 4).toString('ascii') === '%PDF'
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const apiKey = getApiKey()
  const base64 = buffer.toString('base64')

  const response = await fetch(`${VISION_BASE}/files:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        inputConfig: { content: base64, mimeType: 'application/pdf' },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        pages: [1, 2, 3, 4, 5],
      }],
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

  const pages = result?.responses || []
  return pages
    .map((p: { fullTextAnnotation?: { text?: string } }) => p.fullTextAnnotation?.text || '')
    .join('\n')
}

async function extractTextFromImageBuffer(buffer: Buffer): Promise<string> {
  const apiKey = getApiKey()
  const base64 = buffer.toString('base64')

  const response = await fetch(`${VISION_BASE}/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: { languageHints: ['en'] },
      }],
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
  return result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || ''
}

export async function extractTextFromBuffer(buffer: Buffer, mimeType?: string): Promise<string> {
  if (isPdf(buffer) || mimeType === 'application/pdf') {
    return extractTextFromPdfBuffer(buffer)
  }
  return extractTextFromImageBuffer(buffer)
}

export async function extractTextFromBase64(base64: string, mimeType: string): Promise<string> {
  return extractTextFromBuffer(Buffer.from(base64, 'base64'), mimeType)
}

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  const contentType = res.headers.get('content-type') || undefined
  return extractTextFromBuffer(Buffer.from(await res.arrayBuffer()), contentType)
}

/**
 * Extract a value from lines of OCR text using a label match.
 * Looks for the label on a line and returns the text that follows on
 * the same line or the next non-empty line.
 */
function extractAfterLabel(lines: string[], labelRegex: RegExp): string {
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(labelRegex)
    if (match) {
      // Try same line first (text after the label)
      const afterLabel = lines[i].replace(labelRegex, '').replace(/^[\s:\.\-]+/, '').trim()
      if (afterLabel.length >= 2) return afterLabel

      // Try next non-empty line
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const next = lines[j].trim()
        if (next.length >= 2 && !/^[*•\-]/.test(next)) return next
      }
    }
  }
  return ''
}

/**
 * Parse OCR text from the GSVK admission form format specifically.
 * Tuned to the exact field labels used in Gurushree Vidya Kendra's form.
 */
export function parseOcrText(text: string): Partial<StudentFormData> {
  const extracted: Partial<StudentFormData> = {}
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const fullText = lines.join(' ')

  // ── Student Name ─────────────────────────────────────────────────────────
  // Form label: "Name of Pupil :"
  const studentName = extractAfterLabel(lines, /name\s*of\s*pupil/i)
    || extractAfterLabel(lines, /name\s*of\s*student/i)
  if (studentName && studentName.length >= 2) {
    extracted.studentName = studentName
      .replace(/^[:\-\.\s]+/, '')
      .replace(/\s*(date|dob|birth|sex|class|std)\s*.*$/i, '')
      .trim()
  }

  // ── Date of Birth ──────────────────────────────────────────────────────────
  // Form label: "Date of Birth :" followed by DD/MM/YYYY
  const dobMatch = fullText.match(
    /date\s*of\s*birth\s*[:\.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
  )
  if (dobMatch?.[1]) {
    const parsed = parseDate(dobMatch[1])
    if (parsed) extracted.dateOfBirth = parsed
  }

  // ── Academic Year ─────────────────────────────────────────────────────────
  // Form header: "Academic Year : 2026-2027" or "20 26 - 20 27" (handwritten gaps)
  const yearMatch = fullText.match(/academic\s*year\s*[:\.]?\s*(\d{4}[\s\-\/]+\d{2,4})/i)
    || fullText.match(/20\s*(\d{2})\s*[-\/]\s*20\s*(\d{2})/i)
  if (yearMatch) {
    if (yearMatch[2]) {
      // Matched the 20XX-20XX pattern
      extracted.academicYear = `20${yearMatch[1]}-${yearMatch[2]}`
    } else {
      extracted.academicYear = yearMatch[1].replace(/\s+/g, '').replace(/(\d{4})(\d{2,4})/, '$1-$2')
    }
  }

  // ── Class (Admission into) ─────────────────────────────────────────────────
  // Form label: "APPLICATION FOR ADMISSION INTO... 2nd (Std)" or "2nd Standard"
  const classMatch = fullText.match(/admission\s*(?:for\s*admission\s*)?into\s*[:\.]?\s*(\w+)/i)
    || fullText.match(/class\s*[:\.]?\s*(\w+)/i)
    || fullText.match(/std\.?\s*[:\.]?\s*(\w+)/i)
  if (classMatch?.[1]) {
    // Convert ordinals: 2nd→2, 3rd→3, 4th→4 etc.
    extracted.className = classMatch[1]
      .replace(/(\d+)(?:st|nd|rd|th)/i, '$1')
      .replace(/standard/i, '')
      .trim()
  }

  // ── Place of Birth ─────────────────────────────────────────────────────────
  // Form: "Place of Birth  Village: X  Taluk: Y  District: Z  State: W"
  const pobLineIdx = lines.findIndex(l => /place\s*of\s*birth/i.test(l))
  if (pobLineIdx >= 0) {
    // Collect village, taluk, district, state across the next 2 lines
    const pobBlock = lines.slice(pobLineIdx, pobLineIdx + 3).join(' ')
    const villageMatch = pobBlock.match(/village\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+taluk|\s+dist|\s+state|$)/i)
    const talukMatch = pobBlock.match(/taluk\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+dist|\s+state|$)/i)
    const districtMatch = pobBlock.match(/district\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+state|$)/i)
    const stateMatch = pobBlock.match(/state\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+aadhar|\s+sex|\s+no\.|$)/i)

    const pobParts = [
      villageMatch?.[1]?.trim(),
      talukMatch?.[1]?.trim(),
      districtMatch?.[1]?.trim(),
      stateMatch?.[1]?.trim(),
    ].filter(Boolean)

    if (pobParts.length > 0) {
      extracted.placeOfBirth = pobParts.join(', ')
    }
  }

  // ── Gender ────────────────────────────────────────────────────────────────
  // Form: "Sex : Male [checkbox] Female [checkbox]" — OCR sees the ticked box
  // Vision typically reads the ticked checkbox as "✓" or "V" near the label
  const sexLineIdx = lines.findIndex(l => /^\*?\s*sex\s*[:\.]?/i.test(l))
  if (sexLineIdx >= 0) {
    const sexBlock = lines.slice(sexLineIdx, sexLineIdx + 2).join(' ')
    if (/female.*[✓✗☑Vv√x]/i.test(sexBlock) || /[✓✗☑Vv√x].*female/i.test(sexBlock)) {
      extracted.gender = 'FEMALE'
    } else if (/male.*[✓✗☑Vv√x]/i.test(sexBlock) || /[✓✗☑Vv√x].*male/i.test(sexBlock)) {
      extracted.gender = 'MALE'
    } else if (/female/i.test(sexBlock)) {
      extracted.gender = 'FEMALE'
    } else if (/male/i.test(sexBlock)) {
      extracted.gender = 'MALE'
    }
  }

  // ── Aadhar Number (Student) ────────────────────────────────────────────────
  // Form: "Aadhar No. of Pupil :" — 12 digit number
  const aadharMatch = fullText.match(/aadhar\s*no\.?\s*of\s*pupil\s*[:\.]?\s*([\d\s]{12,16})/i)
    || fullText.match(/aadhar\s*no\.?\s*[:\.]?\s*([\d\s]{12,16})/i)
  if (aadharMatch?.[1]) {
    const digits = aadharMatch[1].replace(/\s/g, '')
    if (digits.length === 12) extracted.aadharNumber = digits
  }

  // ── Father Name ───────────────────────────────────────────────────────────
  // Form: "Father Name :" — appears before "Educational Qualification"
  const fatherName = extractAfterLabel(lines, /\*?\s*father\s*name/i)
    || extractAfterLabel(lines, /father['s]?\s*name/i)
  if (fatherName && fatherName.length >= 2) {
    extracted.fatherName = fatherName
      .replace(/^[:\-\.\s]+/, '')
      .replace(/\s*(educational|qualif|occup|aadhar|mother)\s*.*$/i, '')
      .trim()
  }

  // ── Mother Name ───────────────────────────────────────────────────────────
  // Form: "Mother's Name :"
  const motherName = extractAfterLabel(lines, /mother['s]?\s*name/i)
  if (motherName && motherName.length >= 2) {
    extracted.motherName = motherName
      .replace(/^[:\-\.\s]+/, '')
      .replace(/\s*(educational|qualif|aadhar|occupation|annual)\s*.*$/i, '')
      .trim()
  }

  // ── Occupation ────────────────────────────────────────────────────────────
  // Form: "Occuptation :" (note the typo in the actual form)
  const occupation = extractAfterLabel(lines, /occup[ta]+ion/i)
  if (occupation) {
    extracted.occupation = occupation
      .replace(/^[:\-\.\s]+/, '')
      .replace(/\s*(aadhar|mother|annual|income)\s*.*$/i, '')
      .trim()
  }

  // ── Annual Income ─────────────────────────────────────────────────────────
  // Form: "Annual Income of the family :"
  const incomeMatch = fullText.match(/annual\s*income\s*(?:of\s*(?:the\s*)?family)?\s*[:\.]?\s*((?:Rs\.?\s*)?[\d,\s\.]+)/i)
  if (incomeMatch?.[1]) {
    extracted.annualIncome = incomeMatch[1]
      .replace(/\s*(per|p\.a|annum|year|no\.|depend|pupil)\s*.*$/i, '')
      .trim()
  }

  // ── Religion ─────────────────────────────────────────────────────────────
  // Form: "Religion" appears in page 2 with a box
  const religionMatch = fullText.match(/religion\s*[:\.]?\s*([A-Za-z]+)/i)
  if (religionMatch?.[1] && !/^(yes|no|general|obc|sc|st)$/i.test(religionMatch[1])) {
    extracted.religion = religionMatch[1].trim()
  }

  // ── Caste ─────────────────────────────────────────────────────────────────
  // Form: "Caste of Pupil :" or Group: General/OBC/SC/ST
  const casteMatch = fullText.match(/caste\s*of\s*pupil\s*[:\.]?\s*([A-Za-z\s]{2,25}?)(?:\s+cert|\s+caste\s+of|\s+mother\s+tongue|$)/i)
    || fullText.match(/group\s*[:\.]?\s*(general|obc|sc|st)\b/i)
  if (casteMatch?.[1]) {
    extracted.caste = casteMatch[1].trim()
  }

  // ── Mother Tongue ─────────────────────────────────────────────────────────
  // Form: "Mother Tongue :"
  const motherTongue = extractAfterLabel(lines, /mother\s*tongue/i)
  if (motherTongue) {
    extracted.motherTongue = motherTongue
      .replace(/^[:\-\.\s\.]+/, '')
      .replace(/\s*(any\s*other|language|personal|marks|present|postal)\s*.*$/i, '')
      .trim()
  }

  // ── Present Postal Address ────────────────────────────────────────────────
  // Form: "Present Postal Address :" — can span multiple lines
  const presentAddrIdx = lines.findIndex(l => /present\s*postal\s*address/i.test(l))
  if (presentAddrIdx >= 0) {
    // Grab the address from the same line and next 2-3 lines
    const addrBlock = lines.slice(presentAddrIdx, presentAddrIdx + 4).join(' ')
    const addrMatch = addrBlock.match(/present\s*postal\s*address\s*[:\.]?\s*(.{5,150}?)(?:\s*contact\s*no|\s*e-?mail|\s*permanent\s*address|$)/i)
    if (addrMatch?.[1]) {
      extracted.address = addrMatch[1].replace(/\s+/g, ' ').trim()
    }
  }

  // ── Phone ─────────────────────────────────────────────────────────────────
  // Form: "Contact No. : Residence :" or "Ph :"
  const phoneMatch = fullText.match(/contact\s*no\.?\s*[:\.]?\s*residence\s*[:\.]?\s*(\d[\d\s]{9,11})/i)
    || fullText.match(/ph\s*[:\.]?\s*(\d{10})/i)
    || fullText.match(/(\d{10})/i)
  if (phoneMatch?.[1]) {
    const digits = phoneMatch[1].replace(/\D/g, '').slice(-10)
    if (digits.length === 10) extracted.phone = digits
  }

  // ── Permanent Address ─────────────────────────────────────────────────────
  // Form: "Permanent Address :"
  const permAddrIdx = lines.findIndex(l => /permanent\s*address/i.test(l))
  if (permAddrIdx >= 0) {
    const permBlock = lines.slice(permAddrIdx, permAddrIdx + 4).join(' ')
    const permMatch = permBlock.match(/permanent\s*address\s*[:\.]?\s*(.{5,150}?)(?:\s*contact|\s*email|\s*$)/i)
    if (permMatch?.[1]) {
      extracted.permanentAddress = permMatch[1].replace(/\s+/g, ' ').trim()
    }
  }

  // ── Previous School ───────────────────────────────────────────────────────
  // Form: "The School Previously Studied :" with a table — take first row
  const prevSchoolIdx = lines.findIndex(l => /previously\s*studied/i.test(l))
  if (prevSchoolIdx >= 0) {
    // The school name is typically on the next line
    for (let i = prevSchoolIdx + 1; i < Math.min(prevSchoolIdx + 5, lines.length); i++) {
      const l = lines[i].trim()
      if (l.length > 4 && !/^(name|school|affil|class|year|marks|date|reason)/i.test(l)) {
        extracted.previousSchool = l.replace(/^\d+\.\s*/, '').trim()
        break
      }
    }
  }

  // ── TC Number ─────────────────────────────────────────────────────────────
  // Form (Office Use): "Transfer Certificate No." or "TC No."
  const tcMatch = fullText.match(/transfer\s*cert(?:ificate)?\s*no\.?\s*[:\.]?\s*([A-Z0-9\-]{4,20})/i)
    || fullText.match(/\bt\.?\s*c\.?\s*no\.?\s*[:\.]?\s*([A-Z0-9\-]{4,20})/i)
  if (tcMatch?.[1]) {
    extracted.tcNumber = tcMatch[1].trim()
  }

  // ── Siblings ──────────────────────────────────────────────────────────────
  // Form: "No. of Brothers  Elders:__ Youngers:__"
  //       "No. of Sisters   Elders:__ Youngers:__"
  const brotherMatch = fullText.match(/no\.?\s*of\s*bro(?:thers?)?\s*[:\.]?\s*(?:elders?\s*[:\.]?\s*(\d+))?\s*(?:youngers?\s*[:\.]?\s*(\d+))?/i)
  const sisterMatch = fullText.match(/no\.?\s*of\s*sis(?:ters?)?\s*[:\.]?\s*(?:elders?\s*[:\.]?\s*(\d+))?\s*(?:youngers?\s*[:\.]?\s*(\d+))?/i)

  if (brotherMatch || sisterMatch) {
    const bElders = parseInt(brotherMatch?.[1] || '0') || 0
    const bYounger = parseInt(brotherMatch?.[2] || '0') || 0
    const sElders = parseInt(sisterMatch?.[1] || '0') || 0
    const sYounger = parseInt(sisterMatch?.[2] || '0') || 0
    const total = bElders + bYounger + sElders + sYounger
    if (total > 0) {
      extracted.siblings = `${bElders + bYounger} brother(s), ${sElders + sYounger} sister(s)`
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
