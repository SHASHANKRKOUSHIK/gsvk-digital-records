import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { bloodGroupLabel, formatDate, getProfileUrl, bufferToArrayBuffer } from '@/lib/utils'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: { parents: { take: 1 } },
    })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parent = student.parents[0]
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const blue = rgb(0.118, 0.251, 0.686) // #1E40AF
    const white = rgb(1, 1, 1)
    const gray = rgb(0.4, 0.4, 0.4)
    const lightGray = rgb(0.95, 0.95, 0.97)

    // Header background
    page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: blue })

    // School name
    page.drawText('GURU SHREE VIDYA KENDRA', {
      x: 40, y: height - 35,
      size: 18, font: boldFont, color: white,
    })
    page.drawText('Student Admission Record', {
      x: 40, y: height - 55,
      size: 11, font: regularFont, color: rgb(0.7, 0.8, 1),
    })

    // Admission number badge
    page.drawText(student.admissionNumber, {
      x: width - 180, y: height - 45,
      size: 12, font: boldFont, color: white,
    })

    let y = height - 115

    // Student name section
    page.drawText(student.studentName, { x: 40, y, size: 20, font: boldFont, color: blue })
    y -= 20
    page.drawText(`${student.gender} · Class ${student.className}${student.section ? ' Sec ' + student.section : ''} · ${student.academicYear}`, {
      x: 40, y, size: 11, font: regularFont, color: gray,
    })
    y -= 30

    // Divider
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) })
    y -= 25

    // Declared as const arrow functions (not `function` declarations) because
    // TypeScript disallows plain function declarations directly inside blocks
    // (e.g. inside this try block) when targeting strict-mode ES5 output.
    // next dev's transform doesn't enforce this, but Vercel's production
    // build does, so arrow function expressions are used here instead.
    const section = (title: string) => {
      page.drawText(title, { x: 40, y, size: 9, font: boldFont, color: blue })
      y -= 14
      page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.85, 0.9, 1) })
      y -= 12
    }

    const row = (label: string, value: string, col = 0) => {
      const xLabel = col === 0 ? 40 : width / 2 + 10
      const xValue = col === 0 ? 140 : width / 2 + 110
      page.drawText(label, { x: xLabel, y, size: 9, font: regularFont, color: gray })
      page.drawText(value || '—', { x: xValue, y, size: 9, font: boldFont, color: rgb(0.15, 0.15, 0.15) })
    }

    // Personal details
    section('PERSONAL DETAILS')
    row('Date of Birth', formatDate(student.dateOfBirth), 0)
    row('Blood Group', bloodGroupLabel(student.bloodGroup), 1)
    y -= 14
    row('Aadhar No.', student.aadharNumber ? `XXXX XXXX ${student.aadharNumber.slice(-4)}` : '—', 0)
    row('Religion', student.religion || '—', 1)
    y -= 20

    // Admission details
    section('ADMISSION DETAILS')
    row('Admission No.', student.admissionNumber, 0)
    row('Admission Date', formatDate(student.admissionDate), 1)
    y -= 14
    row('Class', `Class ${student.className}`, 0)
    row('Section', student.section || '—', 1)
    y -= 14
    row('Academic Year', student.academicYear, 0)
    row('Previous School', student.previousSchool || '—', 1)
    y -= 14
    if (student.tcNumber) {
      row('TC Number', student.tcNumber, 0)
    }
    y -= 20

    // Parent details
    if (parent) {
      section('PARENT / GUARDIAN DETAILS')
      if (parent.fatherName) { row('Father', parent.fatherName, 0) }
      if (parent.motherName) { row('Mother', parent.motherName, 1) }
      y -= 14
      if (parent.phone) { row('Phone', parent.phone, 0) }
      if (parent.alternatePhone) { row('Alt. Phone', parent.alternatePhone, 1) }
      y -= 14
      if (parent.email) { row('Email', parent.email, 0) }
      if (parent.occupation) { row('Occupation', parent.occupation, 1) }
      y -= 20

      // Address
      if (parent.address || parent.city) {
        section('ADDRESS')
        if (parent.address) { row('Street', parent.address, 0) }
        if (parent.city) { row('City', parent.city, 1) }
        y -= 14
        if (parent.district) { row('District', parent.district, 0) }
        if (parent.state) { row('State', parent.state, 1) }
        y -= 14
        if (parent.pincode) { row('Pincode', parent.pincode, 0) }
        y -= 20
      }
    }

    if (student.remarks) {
      section('REMARKS')
      page.drawText(student.remarks, { x: 40, y, size: 9, font: regularFont, color: rgb(0.3, 0.3, 0.3), maxWidth: width - 80 })
      y -= 20
    }

    // Footer
    page.drawRectangle({ x: 0, y: 0, width, height: 50, color: lightGray })
    page.drawText(`Profile URL: ${getProfileUrl(id)}`, {
      x: 40, y: 28, size: 8, font: regularFont, color: blue,
    })
    page.drawText(`Generated: ${new Date().toLocaleDateString('en-IN')} · Guru Shree Vidya Kendra`, {
      x: 40, y: 14, size: 8, font: regularFont, color: gray,
    })

    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = Buffer.from(pdfBytes)

    return new NextResponse(bufferToArrayBuffer(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${student.studentName.replace(/\s/g, '_')}_${student.admissionNumber}.pdf"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
