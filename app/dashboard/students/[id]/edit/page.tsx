import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import StudentForm from '@/components/forms/StudentForm'

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const student = await prisma.student.findUnique({
    where: { id },
    include: { parents: { take: 1 } },
  })

  if (!student) notFound()

  const parent = student.parents[0]
  const defaultValues = {
    admissionNumber: student.admissionNumber,
    admissionDate: student.admissionDate.toISOString().split('T')[0],
    studentName: student.studentName,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth.toISOString().split('T')[0],
    bloodGroup: student.bloodGroup,
    aadharNumber: student.aadharNumber || '',
    className: student.className,
    section: student.section || '',
    academicYear: student.academicYear,
    religion: student.religion || '',
    caste: student.caste || '',
    previousSchool: student.previousSchool || '',
    tcNumber: student.tcNumber || '',
    remarks: student.remarks || '',
    placeOfBirth: student.placeOfBirth || '',
    siblings: student.siblings || '',
    motherTongue: student.motherTongue || '',
    penNumber: student.penNumber || '',
    satsNumber: student.satsNumber || '',
    apaarId: student.apaarId || '',
    fatherName: parent?.fatherName || '',
    motherName: parent?.motherName || '',
    guardianName: parent?.guardianName || '',
    phone: parent?.phone || '',
    alternatePhone: parent?.alternatePhone || '',
    email: parent?.email || '',
    address: parent?.address || '',
    city: parent?.city || '',
    district: parent?.district || '',
    state: parent?.state || '',
    pincode: parent?.pincode || '',
    occupation: parent?.occupation || '',
    annualIncome: parent?.annualIncome || '',
    permanentAddress: parent?.permanentAddress || '',
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Student</h1>
        <p className="text-sm text-gray-500 mt-1">{student.studentName} — {student.admissionNumber}</p>
      </div>
      <StudentForm studentId={id} defaultValues={defaultValues} />
    </div>
  )
}
