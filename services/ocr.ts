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

// ─── Vision API calls ────────────────────────────────────────────────────────

async function extractFromPdf(buffer: Buffer): Promise<{ text: string; blocks: VisionBlock[] }> {
  const apiKey = getApiKey()
  const res = await fetch(`${VISION_BASE}/files:annotate?key=${apiKey}`, {
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
  if (!res.ok) throw new Error(`Vision API HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.error) throw new Error(`Vision API: ${data.error.message}`)
  const result = data.responses?.[0]
  if (result?.error) throw new Error(`Vision API: ${result.error.message}`)

  // Collect full text and word-level blocks from all pages
  const allText: string[] = []
  const allBlocks: VisionBlock[] = []
  let pageOffset = 0

  for (const page of (result?.responses || [])) {
    const pageText = page.fullTextAnnotation?.text || ''
    allText.push(pageText)

    // Extract word blocks with normalized Y positions (0-1 per page, offset by page number)
    for (const block of (page.fullTextAnnotation?.pages?.[0]?.blocks || [])) {
      for (const para of (block.paragraphs || [])) {
        for (const word of (para.words || [])) {
          const text = (word.symbols || []).map((s: { text: string }) => s.text).join('')
          const verts = word.boundingBox?.normalizedVertices || word.boundingBox?.vertices
          if (verts && verts.length >= 2) {
            allBlocks.push({
              text,
              x: verts[0].x || 0,
              y: (verts[0].y || 0) + pageOffset,
              page: pageOffset,
            })
          }
        }
      }
    }
    pageOffset += 1
  }

  return { text: allText.join('\n'), blocks: allBlocks }
}

async function extractFromImage(buffer: Buffer): Promise<{ text: string; blocks: VisionBlock[] }> {
  const apiKey = getApiKey()
  const res = await fetch(`${VISION_BASE}/images:annotate?key=${apiKey}`, {
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
  if (!res.ok) throw new Error(`Vision API HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.error) throw new Error(`Vision API: ${data.error.message}`)
  const result = data.responses?.[0]
  if (result?.error) throw new Error(`Vision API: ${result.error.message}`)

  const text = result?.fullTextAnnotation?.text || ''
  const blocks: VisionBlock[] = []

  for (const block of (result?.fullTextAnnotation?.pages?.[0]?.blocks || [])) {
    for (const para of (block.paragraphs || [])) {
      for (const word of (para.words || [])) {
        const wText = (word.symbols || []).map((s: { text: string }) => s.text).join('')
        const verts = word.boundingBox?.normalizedVertices || word.boundingBox?.vertices
        if (verts && verts.length >= 2) {
          blocks.push({ text: wText, x: verts[0].x || 0, y: verts[0].y || 0, page: 0 })
        }
      }
    }
  }

  return { text, blocks }
}

interface VisionBlock {
  text: string
  x: number  // 0-1 normalized within page
  y: number  // 0-1 per page + page number offset
  page: number
}

export async function extractTextFromBuffer(buffer: Buffer, mimeType?: string): Promise<string> {
  const { text } = await extractRaw(buffer, mimeType)
  return text
}

async function extractRaw(buffer: Buffer, mimeType?: string): Promise<{ text: string; blocks: VisionBlock[] }> {
  if (isPdf(buffer) || mimeType === 'application/pdf') return extractFromPdf(buffer)
  return extractFromImage(buffer)
}

export async function extractTextFromBase64(base64: string, mimeType: string): Promise<string> {
  return extractTextFromBuffer(Buffer.from(base64, 'base64'), mimeType)
}

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  return extractTextFromBuffer(Buffer.from(await res.arrayBuffer()), res.headers.get('content-type') || undefined)
}

// ─── OCR Text Parser ─────────────────────────────────────────────────────────

/**
 * Fix common OCR digit confusions: B→8, O→0, l/I→1, S→5, Z→2, G→6
 */
function fixDigits(s: string): string {
  return s.replace(/B/g,'8').replace(/O/g,'0').replace(/l/g,'1')
         .replace(/I(?=\d)/g,'1').replace(/S(?=\d)/g,'5')
}

function parseDate(raw: string): string | null {
  const fixed = fixDigits(raw)
  const m = fixed.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
  if (!m) return null
  let [, d, mo, y] = m
  if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`
  try {
    const dt = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`)
    return isNaN(dt.getTime()) ? null : dt.toISOString()
  } catch { return null }
}

/**
 * Given lines of OCR text, find the label and return ONLY the text
 * that appears after the colon on that same line, or on the very next
 * non-label line. Strictly limits capture to avoid bleeding into
 * adjacent form fields.
 */
function strictAfterLabel(lines: string[], labelRe: RegExp): string {
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue

    // Remove the label from the line
    const rest = lines[i].replace(labelRe, '').replace(/^[\s:\.\-,*•]+/, '').trim()

    // If substantial text remains on same line, that's the value
    if (rest.length >= 2 && !/^\*/.test(rest)) {
      // Make sure it doesn't look like another label
      if (!/^(name|date|place|sex|no\.|aadhar|father|mother|educ|occup|annual|contact|relig|caste|mother\s*t|present|perm|nation|group|pupil\s*stay)/i.test(rest)) {
        return rest
      }
    }

    // Look at next line only — and only if it doesn't start with a label marker
    if (i + 1 < lines.length) {
      const next = lines[i + 1].replace(/^[\s:\.\-,*•]+/, '').trim()
      if (next.length >= 2
        && !next.startsWith('*')
        && !/^(name\s+of|date\s+of|place\s+of|sex\s*:|no\.\s+of|aadhar|father|mother|educ|occup|annual|contact|relig|caste|mother\s+t|present|perm|nation|group|whether|pupil)/i.test(next)) {
        return next
      }
    }
  }
  return ''
}

export function parseOcrText(text: string): Partial<StudentFormData> {
  const extracted: Partial<StudentFormData> = {}

  // Split into lines, trim each
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const full = rawLines.join(' ')

  // ── 1. ACADEMIC YEAR ─────────────────────────────────────────────────────
  // Header: "Academic Year : 20 26 - 20 27"
  const yearM = full.match(/academic\s+year\s*[:\.]?\s*20\s*(\d{1,2})\s*[-–]\s*20\s*(\d{1,2})/i)
  if (yearM) extracted.academicYear = `20${yearM[1]}-${yearM[2]}`

  // ── 2. CLASS ─────────────────────────────────────────────────────────────
  // "APPLICATION FOR ADMISSION INTO.... 2nd (Std)"
  const classM = full.match(/admission\s+(?:for\s+admission\s+)?into\s*[:\.\-\s]+(\w+)/i)
  if (classM?.[1]) {
    extracted.className = classM[1].replace(/(\d+)(?:st|nd|rd|th)/i,'$1')
      .replace(/standard|std/i,'').trim()
  }

  // ── 3. STUDENT NAME ──────────────────────────────────────────────────────
  // "* Name of Pupil  :  L MOULYA"
  // Strategy: find the label line, then get text after the colon on that line
  for (let i = 0; i < rawLines.length; i++) {
    if (!/name\s+of\s+pupil/i.test(rawLines[i])) continue
    // The value is everything after the last colon on this line
    const colonIdx = rawLines[i].lastIndexOf(':')
    if (colonIdx >= 0) {
      const val = rawLines[i].slice(colonIdx + 1).replace(/^[\s\.\-]+/, '').trim()
      if (val.length >= 2 && /[A-Za-z]/.test(val)) {
        extracted.studentName = val.replace(/[^A-Za-z\s\.]/g, ' ').replace(/\s+/g, ' ').trim()
        break
      }
    }
    // Try next line
    if (i + 1 < rawLines.length) {
      const next = rawLines[i+1].replace(/^[\s\.\-:*]+/, '').trim()
      if (next.length >= 2 && /[A-Za-z]/.test(next) && !/date\s+of|place\s+of|sex\s*:/i.test(next)) {
        extracted.studentName = next.replace(/[^A-Za-z\s\.]/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }
    break
  }

  // ── 4. DATE OF BIRTH ──────────────────────────────────────────────────────
  // Find the DOB line specifically and extract digit pattern
  for (let i = 0; i < rawLines.length; i++) {
    if (!/date\s+of\s+birth/i.test(rawLines[i])) continue
    // Check this line and next for a date pattern
    const check = rawLines.slice(i, i+2).join(' ')
    const dm = check.match(/[:\.]\s*([\dBbOoIilSsZz]{1,2}[\/\-\.][\dBbOoIilSsZz]{1,2}[\/\-\.][\dBbOoIilSsZz]{2,4})/)
    if (dm) {
      const parsed = parseDate(dm[1])
      if (parsed) { extracted.dateOfBirth = parsed; break }
    }
    break
  }

  // ── 5. PLACE OF BIRTH ────────────────────────────────────────────────────
  // "* Place of Birth  Village: X  Taluk: Y" / next line "District: Z  State: W"
  const pobIdx = rawLines.findIndex(l => /place\s+of\s+birth/i.test(l))
  if (pobIdx >= 0) {
    const block = rawLines.slice(pobIdx, pobIdx + 3).join(' ')
    const village  = block.match(/village\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+taluk\b|\s+dist\b|\s+state\b|$)/i)?.[1]?.trim()
    const taluk    = block.match(/taluk\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+dist\b|\s+state\b|$)/i)?.[1]?.trim()
    const district = block.match(/district\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+state\b|$)/i)?.[1]?.trim()
    const state    = block.match(/state\s*[:\.]?\s*([A-Za-z\s\.]+?)(?:\s+sex\b|\s+\*|\s+no\.|$)/i)?.[1]?.trim()
    const parts = [village, taluk, district, state].filter(Boolean)
    if (parts.length) extracted.placeOfBirth = parts.join(', ')
  }

  // ── 6. GENDER ────────────────────────────────────────────────────────────
  // "* Sex  :  Male [ ]  Female [✓]"
  const sexIdx = rawLines.findIndex(l => /^\*?\s*sex\s*[:\.]?\s*(male|female)?/i.test(l))
  if (sexIdx >= 0) {
    const sexBlock = rawLines.slice(sexIdx, sexIdx + 2).join(' ')
    const femalePos = sexBlock.search(/female/i)
    const tickM = sexBlock.match(/[✓✗☑vVlL✔xX]/gi) || []
    // If tick appears after "Female" text position
    const afterFemale = sexBlock.slice(Math.max(0, femalePos)).match(/[✓✗☑vVlL✔xX]/i)
    const beforeFemale = femalePos > 0 ? sexBlock.slice(0, femalePos).match(/[✓✗☑vVlL✔xX]/i) : null
    if (afterFemale) extracted.gender = 'FEMALE'
    else if (beforeFemale) extracted.gender = 'MALE'
    else if (/female/i.test(sexBlock)) extracted.gender = 'FEMALE'
    else extracted.gender = 'MALE'
  }

  // ── 7. AADHAR (STUDENT) ──────────────────────────────────────────────────
  // "* Aadhar No. of Pupil  :  8063 2598 4991"
  for (let i = 0; i < rawLines.length; i++) {
    if (!/aadhar\s+no\.?\s+of\s+pupil/i.test(rawLines[i])) continue
    const check = rawLines.slice(i, i+2).join(' ')
    const dm = check.match(/of\s+pupil\s*[:\.]?\s*([\dBbOoIilSs\s]{12,18})/)
    if (dm) {
      const digits = fixDigits(dm[1]).replace(/\D/g,'')
      if (digits.length === 12) { extracted.aadharNumber = digits; break }
    }
    break
  }

  // ── 8. FATHER NAME ───────────────────────────────────────────────────────
  // "* Father Name  :  B LOKESH"
  // Critical: stop BEFORE educational qualification / occupation lines
  for (let i = 0; i < rawLines.length; i++) {
    if (!/^\*?\s*father\s+name/i.test(rawLines[i])) continue
    const colonIdx = rawLines[i].lastIndexOf(':')
    if (colonIdx >= 0) {
      const val = rawLines[i].slice(colonIdx + 1).replace(/^[\s\.\-]+/, '').trim()
      if (val.length >= 2 && /[A-Za-z]/.test(val)
        && !/educ|qualif|occup|aadhar/i.test(val)) {
        extracted.fatherName = val; break
      }
    }
    if (i+1 < rawLines.length) {
      const next = rawLines[i+1].replace(/^[\s\.\-:]+/, '').trim()
      if (next.length >= 2 && /[A-Za-z]/.test(next)
        && !/^\*|educ|qualif|occup|aadhar|mother/i.test(next)) {
        extracted.fatherName = next
      }
    }
    break
  }

  // ── 9. MOTHER NAME ───────────────────────────────────────────────────────
  // "* Mother's Name  :  Chandrakala M"
  for (let i = 0; i < rawLines.length; i++) {
    if (!/^\*?\s*mother'?s?\s+name/i.test(rawLines[i])) continue
    const colonIdx = rawLines[i].lastIndexOf(':')
    if (colonIdx >= 0) {
      const val = rawLines[i].slice(colonIdx + 1).replace(/^[\s\.\-]+/, '').trim()
      if (val.length >= 2 && /[A-Za-z]/.test(val)
        && !/educ|qualif|occup|aadhar|annual/i.test(val)) {
        extracted.motherName = val; break
      }
    }
    if (i+1 < rawLines.length) {
      const next = rawLines[i+1].replace(/^[\s\.\-:]+/, '').trim()
      if (next.length >= 2 && /[A-Za-z]/.test(next)
        && !/^\*|educ|qualif|aadhar|occup|annual/i.test(next)) {
        extracted.motherName = next
      }
    }
    break
  }

  // ── 10. OCCUPATION (father, page 1 label "Occuptation") ──────────────────
  // Specifically the FIRST occurrence of occupation/occuptation
  for (let i = 0; i < rawLines.length; i++) {
    if (!/^\*?\s*occup[ta]+ion/i.test(rawLines[i])) continue
    const colonIdx = rawLines[i].lastIndexOf(':')
    if (colonIdx >= 0) {
      const val = rawLines[i].slice(colonIdx + 1).replace(/^[\s\.\-]+/, '').trim()
      if (val.length >= 2 && !/aadhar|mother|annual|no\.\s*of/i.test(val)) {
        extracted.occupation = val; break
      }
    }
    if (i+1 < rawLines.length) {
      const next = rawLines[i+1].replace(/^[\s\.\-:]+/, '').trim()
      if (next.length >= 2 && !/^\*|aadhar|mother|annual|no\.\s*of/i.test(next)) {
        extracted.occupation = next
      }
    }
    break
  }

  // ── 11. ANNUAL INCOME (page 2) ───────────────────────────────────────────
  // "* Annual Income of the family  :  95,000"
  const incomeM = full.match(/annual\s+income\s+(?:of\s+(?:the\s+)?family)?\s*[:\.]?\s*((?:Rs\.?\s*)?[\d,\.\s]+)/i)
  if (incomeM?.[1]) {
    extracted.annualIncome = incomeM[1]
      .replace(/\s*(no\.|depend|pupil|staying|pardon|guardian|paying).*/i, '')
      .trim()
  }

  // ── 12. RELIGION (page 2 box) ────────────────────────────────────────────
  // Appears in box: "Religion [Hindu]" next to "Nationality [India]"
  // The OCR reads something like: "Nationality India Religion Hindu"
  const religionM = full.match(/religion\s*[:\.\[\]]?\s*([A-Za-z]+)/i)
  if (religionM?.[1] && !/^(yes|no|general|obc|sc|st|india|indian|nation|pupil|pardon)$/i.test(religionM[1])) {
    extracted.religion = religionM[1].trim()
  }

  // ── 13. CASTE ────────────────────────────────────────────────────────────
  // "Caste of Pupil  Vokkaliga"
  for (let i = 0; i < rawLines.length; i++) {
    if (!/caste\s+of\s+pupil/i.test(rawLines[i])) continue
    // Value is on same line after label, OR next line
    const rest = rawLines[i].replace(/caste\s+of\s+pupil/i,'').replace(/^[\s:\.\-]+/,'').trim()
    if (rest.length >= 2 && !/certif|no\./i.test(rest)) { extracted.caste = rest; break }
    if (i+1 < rawLines.length) {
      const next = rawLines[i+1].replace(/^[\s\.\-:]+/,'').trim()
      if (next.length >= 2 && !/^\*|caste\s+of\s+father|certif/i.test(next)) extracted.caste = next
    }
    break
  }

  // ── 14. MOTHER TONGUE ────────────────────────────────────────────────────
  // "* Mother Tongue  :  Kannada"
  // IMPORTANT: do NOT pick up "India" from Nationality box nearby
  for (let i = 0; i < rawLines.length; i++) {
    if (!/mother\s+tongue/i.test(rawLines[i])) continue
    const colonIdx = rawLines[i].lastIndexOf(':')
    if (colonIdx >= 0) {
      const val = rawLines[i].slice(colonIdx + 1).replace(/^[\s\.\-]+/, '').trim()
      if (val.length >= 2 && !/^(india|yes|no|nation|general|obc)$/i.test(val)
        && /[A-Za-z]/.test(val)) {
        extracted.motherTongue = val
          .replace(/\s*(any\s+other|language|personal|marks|present|contact).*/i, '').trim()
        break
      }
    }
    // Next line
    if (i+1 < rawLines.length) {
      const next = rawLines[i+1].replace(/^[\s\.\-:.]+/, '').trim()
      if (next.length >= 2
        && !/^\*|any\s+other|language|personal|marks|present|contact|india/i.test(next)
        && /[A-Za-z]/.test(next)) {
        extracted.motherTongue = next
      }
    }
    break
  }

  // ── 15. PRESENT POSTAL ADDRESS ───────────────────────────────────────────
  // "* Present Postal Address :  # 30, 1st cross, Swarna Nagar"
  // Collect up to 2 continuation lines, stop at "Contact", "E-mail", "Whether"
  const presentIdx = rawLines.findIndex(l => /present\s+postal\s+address/i.test(l))
  if (presentIdx >= 0) {
    const parts: string[] = []
    // Same line after the label
    const sameLine = rawLines[presentIdx]
      .replace(/\*?\s*present\s+postal\s+address/i, '')
      .replace(/^[\s:\.\-]+/, '').trim()
    // Only keep if it looks like an address, not form labels
    if (sameLine.length >= 3 && /[\d#]|[A-Za-z]{3}/.test(sameLine)
      && !/whether|bpl|bhagya|cwpn|orphan|hiv|infected/i.test(sameLine)) {
      parts.push(sameLine)
    }
    for (let j = presentIdx + 1; j < Math.min(presentIdx + 4, rawLines.length); j++) {
      const l = rawLines[j].trim()
      if (/^\*?\s*(contact|e-?mail|permanent|whether|bpl|bhagya|cwpn|orphan|hiv)/i.test(l)) break
      if (l.length >= 3 && !/^\*/.test(l)) parts.push(l)
    }
    if (parts.length) {
      extracted.address = parts.join(', ')
        .replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }

  // ── 16. PHONE ────────────────────────────────────────────────────────────
  // "Contact No. : Residence :  9620077887"
  const phoneM = full.match(/contact\s+no\.?\s*[:\.]?\s*residence\s*[:\.]?\s*([\d\s]{10,14})/i)
    || full.match(/residence\s*[:\.]?\s*([\d\s]{10,14})/i)
  if (phoneM?.[1]) {
    const d = phoneM[1].replace(/\D/g,'').slice(-10)
    if (d.length === 10) extracted.phone = d
  }

  // ── 17. PERMANENT ADDRESS ────────────────────────────────────────────────
  // "* Permanent Address :  Kangapuram (v), Amarapuram (m)..."
  const permIdx = rawLines.findIndex(l => /^\*?\s*permanent\s+address/i.test(l))
  if (permIdx >= 0) {
    const parts: string[] = []
    const sameLine = rawLines[permIdx]
      .replace(/\*?\s*permanent\s+address/i,'').replace(/^[\s:\.\-]+/,'').trim()
    if (sameLine.length >= 3) parts.push(sameLine)
    for (let j = permIdx + 1; j < Math.min(permIdx + 4, rawLines.length); j++) {
      const l = rawLines[j].trim()
      if (/^\*?\s*(contact|e-?mail|school\s+prev|whether|vaccin|language)/i.test(l)) break
      if (l.length >= 3 && !/^\*/.test(l)) parts.push(l)
    }
    if (parts.length) {
      extracted.permanentAddress = parts.join(', ')
        .replace(/,\s*,/g,',').replace(/\s+/g,' ').trim()
    }
  }

  // ── 18. PREVIOUS SCHOOL ──────────────────────────────────────────────────
  // Table: skip header row, take first data row
  const prevIdx = rawLines.findIndex(l => /previously\s+studied/i.test(l))
  if (prevIdx >= 0) {
    for (let i = prevIdx + 1; i < Math.min(prevIdx + 8, rawLines.length); i++) {
      const l = rawLines[i].trim()
      // Skip table column headers
      if (/name\s*&?\s*address|school\s+affil|classes\s+stud|year\s+of|%\s+of\s+marks|date\s+of\s+leav/i.test(l)) continue
      // Skip empty or short lines
      if (l.length < 4) continue
      // Skip lines that are clearly not school names
      if (/whether\s+vacc|any\s+deform|language\s+stud|medium\s+of/i.test(l)) break
      if (/[A-Za-z]{3}/.test(l)) {
        extracted.previousSchool = l.replace(/^\d+\.\s*/, '').trim()
        break
      }
    }
  }

  // ── 19. SIBLINGS ─────────────────────────────────────────────────────────
  // "No. of Brothers : Elders: [LL] Youngers: [LL]"
  // Try to count digits in the boxes
  const brotherL = rawLines.find(l => /no\.?\s+of\s+b(?:ro|ort)/i.test(l)) || ''
  const sisterL  = rawLines.find(l => /no\.?\s+of\s+s(?:is|ister)/i.test(l)) || ''
  const bMatch = brotherL.match(/elders?\s*[:\.]?\s*(\d+).*younger\s*[:\.]?\s*(\d+)/i)
  const sMatch = sisterL.match(/elders?\s*[:\.]?\s*(\d+).*younger\s*[:\.]?\s*(\d+)/i)
  if (bMatch || sMatch) {
    const bT = (parseInt(bMatch?.[1]||'0')||0) + (parseInt(bMatch?.[2]||'0')||0)
    const sT = (parseInt(sMatch?.[1]||'0')||0) + (parseInt(sMatch?.[2]||'0')||0)
    if (bT + sT > 0) extracted.siblings = `${bT} brother(s), ${sT} sister(s)`
  }

  return extracted
}
