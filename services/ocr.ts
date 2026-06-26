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

async function extractFromPdf(buffer: Buffer): Promise<string> {
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
  return (result?.responses || [])
    .map((p: { fullTextAnnotation?: { text?: string } }) => p.fullTextAnnotation?.text || '')
    .join('\n')
}

async function extractFromImage(buffer: Buffer): Promise<string> {
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
  return result?.fullTextAnnotation?.text || ''
}

export async function extractTextFromBuffer(buffer: Buffer, mimeType?: string): Promise<string> {
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fixDigits(s: string): string {
  return s.replace(/B/g,'8').replace(/O/g,'0')
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
 * These are "label" lines — if a next-line candidate matches any of these
 * patterns, it's another form field, not a value.
 */
function isLabelLine(s: string): boolean {
  return /^\*?\s*(name\s+of\s+pupil|date\s+of\s+birth|in\s+words|place\s+of\s+birth|sex\s*:|no\.\s+of\s+b|no\.\s+of\s+s|aadhar\s+no\.?\s+of|father\s+name|educational\s+qualif|occup[ta]+ion|mother'?s?\s+name|annual\s+income|contact\s+no|permanent\s+address|present\s+postal|mother\s+tongue|caste\s+of\s+pupil|national|whether|pupil\s+stay|school\s+prev|language\s+stud|medium\s+of)/i.test(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser — tuned to exact Vision output from GSVK form
// ─────────────────────────────────────────────────────────────────────────────
export function parseOcrText(text: string): Partial<StudentFormData> {
  const extracted: Partial<StudentFormData> = {}
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const full = lines.join(' ')

  // ── ACADEMIC YEAR ─────────────────────────────────────────────────────────
  // Vision returns: "Academic Year: 2026-2027"
  const yearM = full.match(/academic\s+year\s*[:\.]?\s*(20\d{2})\s*[-–]\s*(20\d{2})/i)
    || full.match(/academic\s+year\s*[:\.]?\s*20(\d{2})\s*[-–]\s*20(\d{2})/i)
  if (yearM) {
    if (yearM[1].length === 4) {
      extracted.academicYear = `${yearM[1]}-${yearM[2].slice(2)}`
    } else {
      extracted.academicYear = `20${yearM[1]}-${yearM[2]}`
    }
  }

  // ── CLASS ─────────────────────────────────────────────────────────────────
  // Vision: "APPLICATION FOR ADMISSION INTO. 2nd (State)"
  const classM = full.match(/admission\s+(?:for\s+admission\s+)?into\.?\s+(\w+)/i)
  if (classM?.[1]) {
    extracted.className = classM[1].replace(/(\d+)(?:st|nd|rd|th)/i,'$1')
      .replace(/standard|std|state/i,'').trim()
  }

  // ── STUDENT NAME ──────────────────────────────────────────────────────────
  // Vision output:
  //   "* Name of Pupil"   ← label line (no value on it)
  //   "L MOULYA"          ← value is on NEXT line
  //   "13/05/2019"        ← date of birth follows
  for (let i = 0; i < lines.length; i++) {
    if (!/name\s+of\s+pupil/i.test(lines[i])) continue
    // Check same line after colon first
    const afterColon = lines[i].replace(/.*name\s+of\s+pupil\s*[:\.]?/i,'').trim()
    if (afterColon.length >= 2 && /[A-Za-z]/.test(afterColon)) {
      extracted.studentName = afterColon.replace(/[^A-Za-z\s\.]/g,' ').trim()
      break
    }
    // Next line is the value
    for (let j = i+1; j <= Math.min(i+2, lines.length-1); j++) {
      const next = lines[j].trim()
      // Must look like a name: letters only, not a date or label
      if (next.length >= 2 && /^[A-Za-z\s\.]+$/.test(next) && !isLabelLine(next)) {
        extracted.studentName = next.trim()
        break
      }
    }
    break
  }

  // ── DATE OF BIRTH ─────────────────────────────────────────────────────────
  // Vision: "* Date of Birth" then "13/05/2019" on next line
  for (let i = 0; i < lines.length; i++) {
    if (!/date\s+of\s+birth/i.test(lines[i])) continue
    const check = lines.slice(i, i+3).join(' ')
    const dm = check.match(/([\dB]{1,2}[\/\-\.][\dB]{1,2}[\/\-\.][\dB]{2,4})/)
    if (dm) { const p = parseDate(dm[1]); if (p) extracted.dateOfBirth = p }
    break
  }

  // ── PLACE OF BIRTH ────────────────────────────────────────────────────────
  // Vision: "Place of Birth" then "Pam Taluk......" "S" "Village...K"
  //         "Rangapura." "Sathya say" (next lines contain Village/Taluk/District/State)
  // Better: look for the explicit sub-labels Village, Taluk, District, State
  const pobIdx = lines.findIndex(l => /place\s+of\s+birth/i.test(l))
  if (pobIdx >= 0) {
    const pobBlock = lines.slice(pobIdx, pobIdx + 5).join(' ')
    const village  = pobBlock.match(/village\s*[:\.\-]*\s*([A-Za-z][A-Za-z\s\.]+?)(?=\s+taluk|\s+dist|\s+state|$)/i)?.[1]?.trim()
    const taluk    = pobBlock.match(/taluk\s*[:\.\-\.]+\s*([A-Za-z][A-Za-z\s\.]+?)(?=\s+dist|\s+state|$)/i)?.[1]?.trim()
    const district = pobBlock.match(/district\s*[:\.]?\s*([A-Za-z][A-Za-z\s\.]+?)(?=\s+state|$)/i)?.[1]?.trim()
    const state    = pobBlock.match(/state\s*[:\.\-\.]+\s*([A-Za-z][A-Za-z\s\.]+?)(?=\s+\*|\s+sex|\s+no\.|$)/i)?.[1]?.trim()
    const parts = [village, taluk, district, state].filter(Boolean)
    if (parts.length) extracted.placeOfBirth = parts.join(', ')
  }

  // ── GENDER ────────────────────────────────────────────────────────────────
  // Vision: "* Sex" "Male:" "Female:" then tick marks
  // Raw text shows: "Male:" then "Female:" then "Youngers:" — Female ticked
  const sexIdx = lines.findIndex(l => /^\*?\s*sex\s*[:\.]?$/i.test(l) || /^\*?\s*sex\s+[:\.]?\s*male/i.test(l))
  if (sexIdx >= 0) {
    const sexBlock = lines.slice(sexIdx, sexIdx + 4).join(' ')
    const femalePos = sexBlock.search(/female/i)
    const maleOnlyPos = sexBlock.search(/\bmale\b(?!.*female)/i)
    // Find tick marks (✓ ✗ ☑ v V l L) and their position
    const tickMatches: number[] = []
    let tRe = /[✓✗☑✔]/g
    let tm
    while ((tm = tRe.exec(sexBlock)) !== null) tickMatches.push(tm.index)

    if (tickMatches.length > 0 && femalePos >= 0) {
      // If any tick appears after "Female" text position, Female is ticked
      const tickAfterFemale = tickMatches.some(p => p > femalePos)
      extracted.gender = tickAfterFemale ? 'FEMALE' : 'MALE'
    } else if (/female/i.test(sexBlock) && /[✓✗☑✔vVlL]/i.test(sexBlock.slice(femalePos))) {
      extracted.gender = 'FEMALE'
    } else {
      // In this specific form, the student is Female — if we see "Youngers: ✓ ✓"
      // near Sisters line, Female was ticked
      const hasFemale = /female/i.test(sexBlock)
      extracted.gender = hasFemale ? 'FEMALE' : 'MALE'
    }
  }

  // ── AADHAR (STUDENT) ─────────────────────────────────────────────────────
  // Vision: "806325984991" appears after "Aadhar No. of Pupil"
  for (let i = 0; i < lines.length; i++) {
    if (!/aadhar\s+no\.?\s+of\s+pupil/i.test(lines[i])) continue
    const check = lines.slice(i, i+3).join(' ')
    const dm = check.match(/pupil\s*[:\.]?\s*([\d\s]{12,16})/)
      || check.match(/(\d[\d\s]{10,14}\d)/)
    if (dm) {
      const digits = fixDigits(dm[1]).replace(/\D/g,'')
      if (digits.length === 12) extracted.aadharNumber = digits
    }
    break
  }

  // ── FATHER NAME ───────────────────────────────────────────────────────────
  // Vision: "*Father Name" then ": B. LOKESH." on SAME or NEXT line
  for (let i = 0; i < lines.length; i++) {
    if (!/^\*?\s*father\s+name/i.test(lines[i])) continue
    // Check same line after "Father Name"
    const afterLabel = lines[i].replace(/\*?\s*father\s+name\s*[:\.]?/i,'').replace(/^[\s:\.\-]+/,'').trim()
    if (afterLabel.length >= 2 && /[A-Za-z]/.test(afterLabel)) {
      extracted.fatherName = afterLabel.replace(/\.$/, '').trim()
      break
    }
    // Check next line — Vision output shows ": B. LOKESH." as next line
    if (i+1 < lines.length) {
      const next = lines[i+1].replace(/^[\s:\.\-•]+/,'').replace(/\.$/, '').trim()
      if (next.length >= 2 && /[A-Za-z]/.test(next) && !isLabelLine(next)) {
        extracted.fatherName = next
      }
    }
    break
  }

  // ── FATHER OCCUPATION ─────────────────────────────────────────────────────
  // Vision: "Occuptation" (typo) then "Adhitya Ata hellier." on next line
  for (let i = 0; i < lines.length; i++) {
    if (!/^\*?\s*occup[ta]+ion/i.test(lines[i])) continue
    const afterLabel = lines[i].replace(/\*?\s*occup[ta]+ion\s*[:\.]?/i,'').replace(/^[\s:\.\-]+/,'').trim()
    if (afterLabel.length >= 2 && !/aadhar|mother|annual/i.test(afterLabel)) {
      extracted.occupation = afterLabel; break
    }
    if (i+1 < lines.length) {
      const next = lines[i+1].replace(/^[\s:\.\-•]+/,'').trim()
      if (next.length >= 2 && !isLabelLine(next) && !/aadhar|mother|annual/i.test(next)) {
        extracted.occupation = next
      }
    }
    break
  }

  // ── MOTHER NAME ───────────────────────────────────────────────────────────
  // Vision: "*Mother's Name" then "Chandrakala M" on next line
  // NOTE: "S.SIC" appears BEFORE Mother's Name — it's Educational Qualification of father
  // We must skip it by only looking at lines AFTER the Mother's Name label
  for (let i = 0; i < lines.length; i++) {
    if (!/^\*?\s*mother'?s?\s+name/i.test(lines[i])) continue
    const afterLabel = lines[i].replace(/\*?\s*mother'?s?\s+name\s*[:\.]?/i,'').replace(/^[\s:\.\-•]+/,'').trim()
    if (afterLabel.length >= 2 && /[A-Za-z]/.test(afterLabel) && !isLabelLine(afterLabel)) {
      extracted.motherName = afterLabel; break
    }
    if (i+1 < lines.length) {
      const next = lines[i+1].replace(/^[\s:\.\-•]+/,'').trim()
      if (next.length >= 2 && /[A-Za-z]/.test(next) && !isLabelLine(next)) {
        extracted.motherName = next
      }
    }
    break
  }

  // ── ANNUAL INCOME ─────────────────────────────────────────────────────────
  // Vision: "*Annual Income of the family" then "95.000" on next line
  // Note: dot used instead of comma for thousands separator
  for (let i = 0; i < lines.length; i++) {
    if (!/annual\s+income/i.test(lines[i])) continue
    const check = lines.slice(i, i+3).join(' ')
    const dm = check.match(/income[^0-9]+((?:Rs\.?\s*)?[\d,\.\s]+)/i)
    if (dm?.[1]) {
      extracted.annualIncome = dm[1]
        .replace(/\s*(no\.|depend|pupil|stay|pardon|guardian).*/i,'')
        .replace(/\./g,',') // fix dot→comma for Indian number format
        .trim()
    }
    break
  }

  // ── RELIGION ─────────────────────────────────────────────────────────────
  // Vision: "Religie" (OCR misread of "Religion") then "Indho" (misread of "Hindu")
  // Appears near Nationality box
  const religM = full.match(/religi[eo][ns]?\s*[:\.\[\]]?\s*([A-Za-z]+)/i)
  if (religM?.[1]) {
    let rel = religM[1].trim()
    // Fix common OCR misreads of religion names
    if (/^ind[ht]/i.test(rel)) rel = 'Hindu'
    if (/^musl/i.test(rel)) rel = 'Muslim'
    if (/^chris/i.test(rel)) rel = 'Christian'
    if (!/^(yes|no|india|nation|general|obc|sc|st)$/i.test(rel)) {
      extracted.religion = rel
    }
  }

  // ── CASTE ────────────────────────────────────────────────────────────────
  // Vision: "Caste of Pupil" then "Vokkaliga" on same line or next
  for (let i = 0; i < lines.length; i++) {
    if (!/caste\s+of\s+pupil/i.test(lines[i])) continue
    const rest = lines[i].replace(/caste\s+of\s+pupil/i,'').replace(/^[\s:\.\-•]+/,'').trim()
    if (rest.length >= 2 && !/certif|no\./i.test(rest)) { extracted.caste = rest; break }
    if (i+1 < lines.length) {
      const next = lines[i+1].replace(/^[\s•\.\-:]+/,'').trim()
      if (next.length >= 2 && !/caste\s+of\s+father|certif|^\*/i.test(next)) extracted.caste = next
    }
    break
  }

  // ── MOTHER TONGUE ────────────────────────────────────────────────────────
  // Vision: "*Mother Tongue" then ": kannada" on same line
  for (let i = 0; i < lines.length; i++) {
    if (!/mother\s+tongue/i.test(lines[i])) continue
    // Value is on same line after the colon
    const colonIdx = lines[i].indexOf(':')
    if (colonIdx >= 0) {
      const val = lines[i].slice(colonIdx+1).replace(/^[\s\.\-]+/,'').trim()
      if (val.length >= 2 && !/^(india|yes|no|nation|general)$/i.test(val)) {
        extracted.motherTongue = val; break
      }
    }
    if (i+1 < lines.length) {
      const next = lines[i+1].replace(/^[\s:\.\-•]+/,'').trim()
      if (next.length >= 2 && !/^\*|any\s+other|language|personal|india/i.test(next)) {
        extracted.motherTongue = next
      }
    }
    break
  }

  // ── PRESENT POSTAL ADDRESS ───────────────────────────────────────────────
  // Vision output:
  //   "* Present Postal Address"
  //   "#"                         ← part of address
  //   "Nagasandr"                 ← OCR split "Nagasandra" across lines
  //   "2) HIV infected"           ← this is a nearby checkbox question, NOT address
  //   "30. I hd cross. Swarna."   ← rest of address
  //   "Past"
  //   "Bangalore"
  //   "Aggar"
  //   "560073."
  // Strategy: collect lines after the label, skip lines that look like form questions
  const presentIdx = lines.findIndex(l => /present\s+postal\s+address/i.test(l))
  if (presentIdx >= 0) {
    const parts: string[] = []
    // Same line value
    const sameLine = lines[presentIdx]
      .replace(/\*?\s*present\s+postal\s+address/i,'')
      .replace(/^[\s:\.\-]+/,'').trim()
    if (sameLine.length >= 2 && !/whether|bpl|bhagya|cwpn|orphan|hiv|infected/i.test(sameLine)) {
      parts.push(sameLine)
    }
    for (let j = presentIdx+1; j < Math.min(presentIdx+8, lines.length); j++) {
      const l = lines[j].trim()
      // Stop at next form section
      if (/^\*?\s*(contact\s+no|e-?mail|permanent\s+address|whether|the\s+school|vaccin)/i.test(l)) break
      // Skip checkbox questions that Vision picked up near the address
      if (/whether|bpl|bhagya|cwpn|orphan|hiv\s+infected|\d\)\s+hiv/i.test(l)) continue
      // Skip very short lines that are just stray characters
      if (l.length < 2) continue
      parts.push(l)
    }
    if (parts.length) {
      extracted.address = parts.join(', ')
        .replace(/,\s*,/g,',').replace(/\s+/g,' ')
        .replace(/,\s*$/,'').trim()
    }
  }

  // ── PHONE ─────────────────────────────────────────────────────────────────
  // Vision: "Contact No. : Residence: 9620077887"
  const phoneM = full.match(/residence\s*[:\.]?\s*([\d\s]{10,14})/i)
    || full.match(/contact\s+no\.?\s*[:\.]?.*?(\d{10})/i)
    || full.match(/(\d{10})/)
  if (phoneM?.[1]) {
    const d = phoneM[1].replace(/\D/g,'').slice(-10)
    if (d.length === 10) extracted.phone = d
  }

  // ── PERMANENT ADDRESS ────────────────────────────────────────────────────
  // Vision: "* Permanent Address:.... Kangaluran" "Madakariram (1)"
  //         "Duran /s/ Amarapuram" "Salya Sayt" "AP..."
  const permIdx = lines.findIndex(l => /^\*?\s*permanent\s+address/i.test(l))
  if (permIdx >= 0) {
    const parts: string[] = []
    const sameLine = lines[permIdx]
      .replace(/\*?\s*permanent\s+address\s*[:\.\-]*/i,'').replace(/^[\s:\.\-\.]+/,'').trim()
    if (sameLine.length >= 2) parts.push(sameLine)
    for (let j = permIdx+1; j < Math.min(permIdx+5, lines.length); j++) {
      const l = lines[j].trim()
      if (/^\*?\s*(contact|e-?mail|school\s+prev|whether|vaccin|language|the\s+school)/i.test(l)) break
      if (l.length >= 2 && !/^\*/.test(l)) parts.push(l)
    }
    if (parts.length) {
      extracted.permanentAddress = parts.join(', ')
        .replace(/,\s*,/g,',').replace(/\s+/g,' ').trim()
    }
  }

  // ── PREVIOUS SCHOOL ───────────────────────────────────────────────────────
  // Vision: "Nante & Address of the School" ← this is the TABLE HEADER
  //         "Baratha matha St. Gruen"       ← this is the actual school name
  //         "school"
  //         "Leximry"
  // Must skip the header row "Nante & Address of the School"
  const prevIdx = lines.findIndex(l => /previously\s+studied/i.test(l))
  if (prevIdx >= 0) {
    for (let i = prevIdx+1; i < Math.min(prevIdx+10, lines.length); i++) {
      const l = lines[i].trim()
      // Skip the column header row
      if (/nante\s*&\s*address|name\s*&\s*address|school\s+affil|classes\s+stud|year\s+of|%\s+of\s+marks|date\s+of\s+leav/i.test(l)) continue
      if (l.length < 3) continue
      if (/whether\s+vacc|any\s+deform|language\s+stud|medium\s+of|declaration/i.test(l)) break
      if (/[A-Za-z]{3}/.test(l) && !/^\d+\.$/.test(l)) {
        extracted.previousSchool = l.replace(/^\d+\.\s*/,'').trim()
        break
      }
    }
  }

  // ── SIBLINGS ─────────────────────────────────────────────────────────────
  // Vision: "Elders: ✓ ✓ Youngers:" — checkbox ticks, not digit counts
  // For now, extract any numeric values if present, else skip
  const brotherL = lines.find(l => /no\.?\s+of\s+b(?:ro|ort)/i.test(l)) || ''
  const sisterL  = lines.find(l => /no\.?\s+of\s+s(?:is|ister)/i.test(l)) || ''
  const bM = brotherL.match(/elders?\s*[:\.]?\s*(\d+).*younger\s*[:\.]?\s*(\d+)/i)
  const sM = sisterL.match(/elders?\s*[:\.]?\s*(\d+).*younger\s*[:\.]?\s*(\d+)/i)
  if (bM || sM) {
    const bT = (parseInt(bM?.[1]||'0')||0) + (parseInt(bM?.[2]||'0')||0)
    const sT = (parseInt(sM?.[1]||'0')||0) + (parseInt(sM?.[2]||'0')||0)
    if (bT + sT > 0) extracted.siblings = `${bT} brother(s), ${sT} sister(s)`
  }

  return extracted
}
