import ExcelJS from 'exceljs'
import { getProfileUrl } from '@/lib/utils'
import type { Student } from '@/types'

interface ExportStudent extends Student {
  parents?: Array<{
    fatherName?: string
    motherName?: string
    phone?: string
    city?: string
  }>
}

function applyHeaderStyle(worksheet: ExcelJS.Worksheet, row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    }
  })
  row.height = 28
}

function addSchoolHeader(worksheet: ExcelJS.Worksheet, title: string, colCount: number) {
  const merge = (row: number) => {
    worksheet.mergeCells(row, 1, row, colCount)
    return worksheet.getRow(row)
  }

  const r1 = merge(1)
  r1.getCell(1).value = 'GURU SHREE VIDYA KENDRA'
  r1.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1E40AF' } }
  r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  r1.height = 32

  const r2 = merge(2)
  r2.getCell(1).value = title
  r2.getCell(1).font = { bold: true, size: 13 }
  r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  r2.height = 24

  const r3 = merge(3)
  r3.getCell(1).value = `Generated on: ${new Date().toLocaleDateString('en-IN')}`
  r3.getCell(1).font = { size: 10, italic: true, color: { argb: 'FF666666' } }
  r3.getCell(1).alignment = { horizontal: 'center' }
  r3.height = 18

  worksheet.addRow([])
}

export async function generateClassWiseExcel(students: ExportStudent[], className: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'GSVK Digital Records'
  workbook.created = new Date()

  const ws = workbook.addWorksheet(`Class_${className}`)
  const columns = ['#', 'Admission No', 'Student Name', 'Gender', 'DOB', 'Academic Year', 'Father Name', 'Mother Name', 'Phone', 'Profile URL']

  addSchoolHeader(ws, `Class ${className} - Student List`, columns.length)

  const headerRow = ws.addRow(columns)
  applyHeaderStyle(ws, headerRow)

  students.forEach((s, i) => {
    const row = ws.addRow([
      i + 1,
      s.admissionNumber,
      s.studentName,
      s.gender,
      new Date(s.dateOfBirth).toLocaleDateString('en-IN'),
      s.academicYear,
      s.parents?.[0]?.fatherName || '',
      s.parents?.[0]?.motherName || '',
      s.parents?.[0]?.phone || '',
      getProfileUrl(s.id),
    ])
    if (i % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
    }
    // Make URL clickable
    const urlCell = row.getCell(10)
    urlCell.value = { text: getProfileUrl(s.id), hyperlink: getProfileUrl(s.id) }
    urlCell.font = { color: { argb: 'FF1E40AF' }, underline: true }
  })

  ws.columns = [
    { width: 6 }, { width: 16 }, { width: 24 }, { width: 10 }, { width: 14 },
    { width: 14 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 40 }
  ]

  ws.autoFilter = { from: 'A5', to: `${String.fromCharCode(64 + columns.length)}5` }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export async function generateYearWiseExcel(students: ExportStudent[], year: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'GSVK Digital Records'
  const ws = workbook.addWorksheet(`Year_${year}`)
  const columns = ['#', 'Admission No', 'Student Name', 'Class', 'Section', 'Gender', 'Father Name', 'Phone', 'Profile URL']

  addSchoolHeader(ws, `Academic Year ${year} - Student List`, columns.length)
  const headerRow = ws.addRow(columns)
  applyHeaderStyle(ws, headerRow)

  students.forEach((s, i) => {
    const row = ws.addRow([
      i + 1, s.admissionNumber, s.studentName, s.className,
      s.section || '', s.gender, s.parents?.[0]?.fatherName || '',
      s.parents?.[0]?.phone || '', getProfileUrl(s.id),
    ])
    if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
    const urlCell = row.getCell(9)
    urlCell.value = { text: getProfileUrl(s.id), hyperlink: getProfileUrl(s.id) }
    urlCell.font = { color: { argb: 'FF1E40AF' }, underline: true }
  })

  ws.columns = [
    { width: 6 }, { width: 16 }, { width: 24 }, { width: 10 }, { width: 10 },
    { width: 10 }, { width: 22 }, { width: 14 }, { width: 40 }
  ]
  ws.autoFilter = { from: 'A5', to: `I5` }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export async function generateCombinedExcel(students: ExportStudent[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'GSVK Digital Records'

  const ws = workbook.addWorksheet('All Students')
  const columns = [
    '#', 'Admission No', 'Admission Date', 'Student Name', 'Gender', 'DOB',
    'Blood Group', 'Class', 'Section', 'Academic Year', 'Father Name',
    'Mother Name', 'Phone', 'Email', 'City', 'State', 'Aadhar', 'Profile URL'
  ]

  addSchoolHeader(ws, 'Complete Student Register', columns.length)
  const headerRow = ws.addRow(columns)
  applyHeaderStyle(ws, headerRow)

  students.forEach((s, i) => {
    const parent = s.parents?.[0]
    const row = ws.addRow([
      i + 1, s.admissionNumber,
      new Date(s.admissionDate).toLocaleDateString('en-IN'),
      s.studentName, s.gender,
      new Date(s.dateOfBirth).toLocaleDateString('en-IN'),
      s.bloodGroup, s.className, s.section || '', s.academicYear,
      parent?.fatherName || '', parent?.motherName || '',
      parent?.phone || '', parent?.['email'] || '',
      parent?.city || '', parent?.['state'] || '',
      s.aadharNumber || '', getProfileUrl(s.id),
    ])
    if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
    const urlCell = row.getCell(18)
    urlCell.value = { text: getProfileUrl(s.id), hyperlink: getProfileUrl(s.id) }
    urlCell.font = { color: { argb: 'FF1E40AF' }, underline: true }
  })

  ws.columns = columns.map((_, i) => ({ width: i === columns.length - 1 ? 40 : 18 }))
  ws.autoFilter = { from: 'A5', to: `R5` }

  // Add class-wise worksheets
  const byClass = students.reduce((acc, s) => {
    ;(acc[s.className] = acc[s.className] || []).push(s)
    return acc
  }, {} as Record<string, ExportStudent[]>)

  for (const [cls, clsStudents] of Object.entries(byClass)) {
    const cws = workbook.addWorksheet(`Class ${cls}`)
    const ccols = ['#', 'Admission No', 'Student Name', 'Gender', 'Father Name', 'Phone', 'Profile URL']
    addSchoolHeader(cws, `Class ${cls}`, ccols.length)
    applyHeaderStyle(cws, cws.addRow(ccols))
    clsStudents.forEach((s, i) => {
      const row = cws.addRow([
        i + 1, s.admissionNumber, s.studentName, s.gender,
        s.parents?.[0]?.fatherName || '', s.parents?.[0]?.phone || '', getProfileUrl(s.id)
      ])
      const urlCell = row.getCell(7)
      urlCell.value = { text: getProfileUrl(s.id), hyperlink: getProfileUrl(s.id) }
      urlCell.font = { color: { argb: 'FF1E40AF' }, underline: true }
    })
    cws.columns = [{ width: 6 }, { width: 16 }, { width: 24 }, { width: 10 }, { width: 22 }, { width: 14 }, { width: 40 }]
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
