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
  const response = await fetch(`${VISION_BASE}/files:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        inputConfig: { content: buffer.toString('base64'), mimeType: 'application/pdf' },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        pages: [1, 2, 3, 4, 5],
      }],
    }),
  })
  if (!response.ok) throw new Error(`Vision API HTTP ${response.status}: ${await response.text()}`)
  const data = await response.json()
  if (data.error) throw new Error(`Vision API error: ${data.error.message}`)
  const result = data.responses?.[0]
  if (result?.error) throw new Error(`Vision API request error: ${result.error.message}`)
  return (result?.responses || [])
    .map((p: { fullTextAnnotation?: { text?: string } }) => p.fullTextAnnotation?.text || '')
    .join('\n')
}

async function extractTextFromImageBuffer(buffer: Buffer): Promise<string> {
  const apiKey = getApiKey()
  const response = await fetch(`${VISION_BASE}/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: buffer.toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: { languageHints: ['en'] },
      }],
    }),
  })
  if (!response.ok) throw new Error(`Vision API HTTP ${response.status}: ${await response.text()}`)
  const data = await response.json()
  if (data.error) throw new Error(`Vision API error: ${data.error.message}`)
  const result = data.responses?.[0]
  if (result?.error) throw new Error(`Vision API request error: ${result.error.message}`)
  return result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || ''
}

export async function extractTextFromBuffer(buffer: Buffer, mimeType?: string): Promise<string> {
  if (isPdf(buffer) || mimeType === 'application/pdf') return extractTextFromPdfBuffer(buffer)
  return extractTextFromImageBuffer(buffer)
}

export async function extractTextFromBase64(base64: string, mimeType: string): Promise<string> {
  return extractTextFromBuffer(Buffer.from(base64, 'base64'), mimeType)
}

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  return extractTextFromBuffer(Buffer.from(await res.arrayBuffer()), res.headers.get('content-type') || undefined)
}

// ─────────────────────────────────────────────────────────────────────────────
// GSVK Form Parser — tuned to the exact Gurushree Vidya Kendra form layout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the value on the same line after a label, or on the next line.
 * Returns the cleaned text or empty string.
 */
function afterLabel(lines: string[], labelRe: RegExp, nextLines = 2): string {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(labelRe)
    if (!m) continue

    // Value on same line, after the label match
    const sameLine = lines[i].slice((m.index ?? 0) + m[0].length)
      .replace(/^[\s:\.\-,*]+/, '').trim()
    if (sameLine.length >= 2) return sameLine

    // Value on next 1-2 lines
    for (let j = i + 1; j <= Math.min(i + nextLines, lines.length - 1); j++) {
      const next = lines[j].replace(/^[\s:\.\-,*]+/, '').trim()
      // Skip lines that look like another label
      if (next.length >= 2 && !/^\*\s*(name|date|place|sex|no\.|aadhar|father|mother|educ|occup|annual|contact|relig|caste|mother\s*tongue|present|perm)/i.test(next)) {
        return next
      }
    }
  }
  return ''
}

/**
 * Fix common OCR character confusions in digit strings:
 * B→8, O→0, l→1, I→1, S→5, Z→2, G→6
 */
function fixDigits(s: string): string {
  return s
    .replace(/[Bb]/g, '8')
    .replace(/[Oo]/g, '0')
    .replace(/[lIi|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Zz]/g, '2')
    .replace(/[Gg]/g, '6')
}

function parseDate(raw: string): string | null {
  // Fix OCR digit errors first
  const fixed = fixDigits(raw)
  // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const m = fixed.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
  if (!m) return null
  let [, d, mo, y] = m
  if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`
  try {
    const date = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`)
    return isNaN(date.getTime()) ? null : date.toISOString()
  } catch { return null }
}

export function parseOcrText(text: string): Partial<StudentFormData> {
  const extracted: Partial<StudentFormData> = {}

  // Split into lines, clean each
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const full = lines.join(' ')

  // ── 1. STUDENT NAME ────────────────────────────────────────────────────────
  // Label: "Name of Pupil"
  const nameVal = afterLabel(lines, /name\s+of\s+pupil/i)
  if (nameVal) {
    extracted.studentName = nameVal
      .replace(/^[:\.\-\s]+/, '')
      .replace(/\s*(date|dob|birth|sex|class|std|aadhar)\s*.*$/i, '')
      .replace(/[^A-Za-z\s\.]/g, ' ').trim()
  }

  // ── 2. DATE OF BIRTH ───────────────────────────────────────────────────────
  // Label: "Date of Birth" — then DD/MM/YYYY (OCR may confuse 2→B)
  const dobLine = afterLabel(lines, /date\s+of\s+birth/i)
  const dobMatch = dobLine.match(/[\dBbOoIilSsZzGg]{1,2}[\/\-\.][\dBbOoIilSsZzGg]{1,2}[\/\-\.][\dBbOoIilSsZzGg]{2,4}/)
    || full.match(/date\s+of\s+birth\s*[:\.]?\s*([\dBbOoIilSsZzGg]{1,2}[\/\-\.][\dBbOoIilSsZzGg]{1,2}[\/\-\.][\dBbOoIilSsZzGg]{2,4})/i)
  if (dobMatch) {
    const parsed = parseDate(dobMatch[1] || dobMatch[0])
    if (parsed) extracted.dateOfBirth = parsed
  }

  // ── 3. ACADEMIC YEAR ───────────────────────────────────────────────────────
  // Header: "Academic Year : 20 26 - 20 27" (may have spaces inside digits)
  const yearMatch = full.match(/academic\s+year\s*[:\.]?\s*20\s*(\d{1,2})\s*[-\/]\s*20\s*(\d{1,2})/i)
    || full.match(/20\s*(\d{2})\s*[-–]\s*20\s*(\d{2})/)
  if (yearMatch) {
    extracted.academicYear = `20${yearMatch[1]}-${yearMatch[2]}`
  }

  // ── 4. CLASS ───────────────────────────────────────────────────────────────
  // "APPLICATION FOR ADMISSION INTO.... 2nd (Std)"
  const classMatch = full.match(/admission\s+(?:for\s+admission\s+)?into\s*[:\.\-]*\s*(\w+)/i)
  if (classMatch?.[1]) {
    extracted.className = classMatch[1]
      .replace(/(\d+)(?:st|nd|rd|th)/i, '$1')
      .replace(/standard|std/i, '')
      .trim()
  }

  // ── 5. PLACE OF BIRTH ─────────────────────────────────────────────────────
  // "Place of Birth  Village: X  Taluk: Y" then "District: Z  State: W"
  const pobIdx = lines.findIndex(l => /place\s+of\s+birth/i.test(l))
  if (pobIdx >= 0) {
    const pobBlock = lines.slice(pobIdx, pobIdx + 3).join(' ')
    const village = pobBlock.match(/village\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+taluk|$)/i)?.[1]?.trim()
    const taluk   = pobBlock.match(/taluk\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+dist|$)/i)?.[1]?.trim()
    const district= pobBlock.match(/district\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+state|$)/i)?.[1]?.trim()
    const state   = pobBlock.match(/state\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s*sex|\s*no\.|\s*aadhar|$)/i)?.[1]?.trim()
    const parts = [village, taluk, district, state].filter(Boolean)
    if (parts.length) extracted.placeOfBirth = parts.join(', ')
  }

  // ── 6. GENDER ─────────────────────────────────────────────────────────────
  // "Sex : Male [ ] Female [✓]" — Vision reads ticked box as "✓" or "v" or "L"
  const sexIdx = lines.findIndex(l => /^\*?\s*sex\s*[:\.]?/i.test(l))
  if (sexIdx >= 0) {
    const sexBlock = lines.slice(sexIdx, sexIdx + 2).join(' ')
    // Check what appears near Female vs Male
    const femalePos = sexBlock.search(/female/i)
    const malePos   = sexBlock.search(/\bmale/i)
    // A tick mark (✓ v L ✗ x) appearing after "Female" suggests Female is ticked
    const tickAfterFemale = sexBlock.slice(femalePos).match(/[✓✗☑vVlL✔xX]/i)
    const tickAfterMale   = malePos >= 0 ? sexBlock.slice(malePos, femalePos > 0 ? femalePos : undefined).match(/[✓✗☑vVlL✔xX]/i) : null
    if (tickAfterFemale && !tickAfterMale) extracted.gender = 'FEMALE'
    else if (tickAfterMale && !tickAfterFemale) extracted.gender = 'MALE'
    else if (/female/i.test(sexBlock)) extracted.gender = 'FEMALE'
    else extracted.gender = 'MALE'
  }

  // ── 7. AADHAR NUMBER (STUDENT) ────────────────────────────────────────────
  // "Aadhar No. of Pupil" — 12 digits possibly with spaces
  const aadharPupilLine = afterLabel(lines, /aadhar\s+no\.?\s+of\s+pupil/i)
  if (aadharPupilLine) {
    const digits = fixDigits(aadharPupilLine).replace(/\D/g, '')
    if (digits.length === 12) extracted.aadharNumber = digits
  }

  // ── 8. FATHER NAME ────────────────────────────────────────────────────────
  // "Father Name" (not "Father's Name" — check both)
  const fatherVal = afterLabel(lines, /father\s+name/i)
    || afterLabel(lines, /father['s]*\s+name/i)
  if (fatherVal) {
    extracted.fatherName = fatherVal
      .replace(/^[:\.\-\s]+/, '')
      .replace(/\s*(educ|qualif|occup|aadhar|mother)\s*.*$/i, '')
      .trim()
  }

  // ── 9. OCCUPATION (FATHER) ────────────────────────────────────────────────
  // Form uses "Occuptation" (typo) in father section on page 1
  const occIdx = lines.findIndex(l => /occup[ta]+ion/i.test(l))
  if (occIdx >= 0) {
    const occVal = afterLabel(lines.slice(occIdx, occIdx + 3), /occup[ta]+ion/i)
    if (occVal) {
      extracted.occupation = occVal
        .replace(/^[:\.\-\s]+/, '')
        .replace(/\s*(aadhar|mother|annual|income|no\.\s*of)\s*.*$/i, '')
        .trim()
    }
  }

  // ── 10. MOTHER NAME ───────────────────────────────────────────────────────
  // "Mother's Name"
  const motherVal = afterLabel(lines, /mother['s]*\s+name/i)
  if (motherVal) {
    extracted.motherName = motherVal
      .replace(/^[:\.\-\s]+/, '')
      .replace(/\s*(educ|qualif|aadhar|annual|occup)\s*.*$/i, '')
      .trim()
  }

  // ── 11. ANNUAL INCOME ─────────────────────────────────────────────────────
  // "Annual Income of the family" on page 2 — value like "95,000" or "95.000"
  const incomeMatch = full.match(/annual\s+income\s+(?:of\s+(?:the\s+)?family)?\s*[:\.]?\s*((?:Rs\.?\s*)?[\d,\.\s]+)/i)
  if (incomeMatch?.[1]) {
    extracted.annualIncome = incomeMatch[1]
      .replace(/\s*(per|p\.a|annum|year|no\.|depend|pupil|staying)\s*.*$/i, '')
      .trim()
  }

  // ── 12. RELIGION ──────────────────────────────────────────────────────────
  // Page 2: "Religion" appears in a box next to "Nationality" box
  // Vision typically reads: "Nationality [India] Religion [Hindu]"
  const religionMatch = full.match(/religion\s*[:\.\[\]]?\s*([A-Za-z]+)/i)
  if (religionMatch?.[1] && !/^(yes|no|general|obc|sc|st|india|indian)$/i.test(religionMatch[1])) {
    extracted.religion = religionMatch[1].trim()
  }

  // ── 13. CASTE ─────────────────────────────────────────────────────────────
  // "Caste of Pupil" — line-by-line extraction
  const casteVal = afterLabel(lines, /caste\s+of\s+pupil/i)
  if (casteVal) {
    extracted.caste = casteVal
      .replace(/^[:\.\-\s]+/, '')
      .replace(/\s+(certif|caste\s+of|father|mother|no\.)\s*.*$/i, '')
      .trim()
  }

  // ── 14. MOTHER TONGUE ─────────────────────────────────────────────────────
  // "Mother Tongue" on page 2
  const mtVal = afterLabel(lines, /mother\s+tongue/i)
  if (mtVal) {
    extracted.motherTongue = mtVal
      .replace(/^[:\.\-\s\.]+/, '')
      .replace(/\s*(any\s+other|language|personal|marks|present|postal|contact)\s*.*$/i, '')
      .trim()
  }

  // ── 15. PRESENT POSTAL ADDRESS ────────────────────────────────────────────
  // "Present Postal Address :" — value spans 1-3 lines
  const presentAddrIdx = lines.findIndex(l => /present\s+postal\s+address/i.test(l))
  if (presentAddrIdx >= 0) {
    // Grab value from same line and next 2 lines, stop at Contact/E-mail
    const parts: string[] = []
    const sameLine = lines[presentAddrIdx]
      .replace(/present\s+postal\s+address/i, '').replace(/^[\s:\.\-]+/, '').trim()
    if (sameLine) parts.push(sameLine)
    for (let j = presentAddrIdx + 1; j < Math.min(presentAddrIdx + 4, lines.length); j++) {
      const l = lines[j].trim()
      if (/contact|e-?mail|permanent|@/i.test(l)) break
      if (l.length > 3) parts.push(l)
    }
    if (parts.length) extracted.address = parts.join(', ').replace(/,\s*,/g, ',').trim()
  }

  // ── 16. PHONE ─────────────────────────────────────────────────────────────
  // "Contact No. : Residence :" on page 2
  const phoneMatch = full.match(/contact\s+no\.?\s*[:\.]?\s*residence\s*[:\.]?\s*([\d\s]{10,14})/i)
    || full.match(/residence\s*[:\.]?\s*([\d\s]{10,14})/i)
    || full.match(/(\d{10})/i)
  if (phoneMatch?.[1]) {
    const digits = phoneMatch[1].replace(/\D/g, '').slice(-10)
    if (digits.length === 10) extracted.phone = digits
  }

  // ── 17. PERMANENT ADDRESS ─────────────────────────────────────────────────
  // "Permanent Address :" — can span 2-3 lines
  const permIdx = lines.findIndex(l => /permanent\s+address/i.test(l))
  if (permIdx >= 0) {
    const parts: string[] = []
    const sameLine = lines[permIdx].replace(/permanent\s+address/i, '').replace(/^[\s:\.\-]+/, '').trim()
    if (sameLine) parts.push(sameLine)
    for (let j = permIdx + 1; j < Math.min(permIdx + 4, lines.length); j++) {
      const l = lines[j].trim()
      if (/contact|e-?mail|office|school\s+prev|whether|vaccin/i.test(l)) break
      if (l.length > 3) parts.push(l)
    }
    if (parts.length) extracted.permanentAddress = parts.join(', ').replace(/,\s*,/g, ',').trim()
  }

  // ── 18. PREVIOUS SCHOOL ───────────────────────────────────────────────────
  // "The School Previously Studied" → first data row
  const prevIdx = lines.findIndex(l => /previously\s+studied/i.test(l))
  if (prevIdx >= 0) {
    for (let i = prevIdx + 1; i < Math.min(prevIdx + 6, lines.length); i++) {
      const l = lines[i].trim()
      // Skip header row labels
      if (/name\s*&?\s*address|affiliation|classes\s+studied|year\s+of|%\s+of\s+marks|date\s+of\s+leaving/i.test(l)) continue
      if (l.length > 4 && /[A-Za-z]/.test(l)) {
        extracted.previousSchool = l.replace(/^\d+\.\s*/, '').trim()
        break
      }
    }
  }

  // ── 19. TC NUMBER ─────────────────────────────────────────────────────────
  const tcMatch = full.match(/t\.?\s*c\.?\s*(?:no|number)?\.?\s*[:\.]?\s*([A-Z0-9\-]{4,20})/i)
    || full.match(/transfer\s+cert(?:ificate)?\s*(?:no|number)?\.?\s*[:\.]?\s*([A-Z0-9\-]{4,20})/i)
  if (tcMatch?.[1] && !/^(no|num|number|xerox|copy|original)$/i.test(tcMatch[1])) {
    extracted.tcNumber = tcMatch[1].trim()
  }

  // ── 20. SIBLINGS ──────────────────────────────────────────────────────────
  // "No. of Brothers : Elders: [LL] Youngers: [LL]"
  // Vision reads checkbox content as letters like "L", "C", numbers
  const brotherLine = lines.find(l => /no\.?\s+of\s+b(?:ro|ort)/i.test(l)) || ''
  const sisterLine  = lines.find(l => /no\.?\s+of\s+s(?:is|ister)/i.test(l)) || ''
  // Try to extract numeric values from the sibling lines
  const bMatch = brotherLine.match(/elders?\s*[:\.]?\s*(\d+).*younger\s*[:\.]?\s*(\d+)/i)
  const sMatch = sisterLine.match(/elders?\s*[:\.]?\s*(\d+).*younger\s*[:\.]?\s*(\d+)/i)
  if (bMatch || sMatch) {
    const bTotal = (parseInt(bMatch?.[1] || '0') || 0) + (parseInt(bMatch?.[2] || '0') || 0)
    const sTotal = (parseInt(sMatch?.[1] || '0') || 0) + (parseInt(sMatch?.[2] || '0') || 0)
    if (bTotal + sTotal > 0) {
      extracted.siblings = `${bTotal} brother(s), ${sTotal} sister(s)`
    }
  }

  return extracted
}
