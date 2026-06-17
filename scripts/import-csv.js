#!/usr/bin/env node
/**
 * Import students from a CSV file.
 * Expected columns: admissionNumber,admissionDate,studentName,gender,dateOfBirth,
 *   bloodGroup,className,section,academicYear,fatherName,motherName,phone,city,state
 *
 * Usage: node scripts/import-csv.js ./data/students.csv
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = values[i] || '' })
    return obj
  })
}

function parseDate(str) {
  if (!str) return new Date()
  const d = new Date(str)
  return isNaN(d.getTime()) ? new Date() : d
}

const BG_MAP = {
  'A+': 'A_POS', 'A-': 'A_NEG', 'B+': 'B_POS', 'B-': 'B_NEG',
  'AB+': 'AB_POS', 'AB-': 'AB_NEG', 'O+': 'O_POS', 'O-': 'O_NEG',
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) { console.error('Usage: node scripts/import-csv.js <file.csv>'); process.exit(1) }

  const content = fs.readFileSync(path.resolve(filePath), 'utf8')
  const rows = parseCSV(content)
  console.log(`Found ${rows.length} rows to import`)

  let created = 0, skipped = 0, errors = 0

  for (const row of rows) {
    if (!row.admissionNumber || !row.studentName) { skipped++; continue }

    try {
      await prisma.student.create({
        data: {
          admissionNumber: row.admissionNumber,
          admissionDate: parseDate(row.admissionDate),
          studentName: row.studentName,
          gender: row.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
          dateOfBirth: parseDate(row.dateOfBirth),
          bloodGroup: BG_MAP[row.bloodGroup] || 'UNKNOWN',
          className: row.className || '1',
          section: row.section || null,
          academicYear: row.academicYear || '2024-25',
          religion: row.religion || null,
          caste: row.caste || null,
          previousSchool: row.previousSchool || null,
          parents: {
            create: [{
              fatherName: row.fatherName || null,
              motherName: row.motherName || null,
              phone: row.phone || null,
              city: row.city || null,
              state: row.state || null,
            }],
          },
        },
      })
      created++
    } catch (e) {
      if (e.code === 'P2002') { skipped++; continue } // Duplicate
      console.error(`Error on row "${row.studentName}":`, e.message)
      errors++
    }
  }

  console.log(`✅ Import complete: ${created} created, ${skipped} skipped, ${errors} errors`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
