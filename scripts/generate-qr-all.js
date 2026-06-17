#!/usr/bin/env node
/**
 * One-time script: Generate QR codes for all students missing them.
 * Usage: node scripts/generate-qr-all.js
 */

const { PrismaClient } = require('@prisma/client')
const QRCode = require('qrcode')

const prisma = new PrismaClient()
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function main() {
  const students = await prisma.student.findMany({
    where: { qrCode: null },
    select: { id: true, studentName: true },
  })

  console.log(`Generating QR codes for ${students.length} students...`)
  let done = 0

  for (const s of students) {
    const url = `${APP_URL}/student/${s.id}`
    const qr = await QRCode.toDataURL(url, {
      width: 200, margin: 2,
      color: { dark: '#1E40AF', light: '#FFFFFF' },
    })
    await prisma.student.update({ where: { id: s.id }, data: { qrCode: qr } })
    done++
    if (done % 50 === 0) console.log(`  ${done}/${students.length} done...`)
  }

  console.log(`✅ Generated ${done} QR codes`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
