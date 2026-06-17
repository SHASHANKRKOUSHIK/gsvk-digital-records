import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate, bloodGroupLabel, classLabel } from '@/lib/utils'
import { GraduationCap, User, Phone, MapPin, FileText, QrCode, Download } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const student = await prisma.student.findUnique({ where: { id }, select: { studentName: true, admissionNumber: true } })
  if (!student) return { title: 'Student Not Found' }
  return { title: `${student.studentName} — GSVK`, description: `Student profile for ${student.studentName} (${student.admissionNumber})` }
}

export default async function StudentProfilePage({ params }: Props) {
  const { id } = await params
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      parents: true,
      documents: { orderBy: { uploadedAt: 'desc' } },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  })

  if (!student || !student.isActive) notFound()

  const parent = student.parents[0]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Guru Shree Vidya Kendra</h1>
            <p className="text-blue-200 text-xs">Student Profile</p>
          </div>
          <div className="ml-auto flex gap-2">
            <a href={`/api/students/${id}/pdf`}
              className="hidden sm:inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-800 to-blue-600 h-24" />
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-4">
              <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center text-3xl font-bold text-blue-700 flex-shrink-0">
                {student.studentName[0]}
              </div>
              <div className="sm:mb-1">
                <h2 className="text-xl font-bold text-gray-900">{student.studentName}</h2>
                <p className="text-sm text-gray-500">{student.admissionNumber} · {classLabel(student.className)}{student.section ? ` Sec ${student.section}` : ''}</p>
              </div>
              {student.qrCode && (
                <div className="sm:ml-auto flex flex-col items-center gap-1">
                  <Image src={student.qrCode} alt="QR Code" width={80} height={80} className="rounded-lg border border-gray-200" />
                  <p className="text-xs text-gray-400">Scan to open</p>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              <Badge color="blue">{student.gender}</Badge>
              <Badge color="emerald">Class {student.className}</Badge>
              <Badge color="violet">{student.academicYear}</Badge>
              <Badge color="amber">{bloodGroupLabel(student.bloodGroup)}</Badge>
              {student.religion && <Badge color="gray">{student.religion}</Badge>}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal */}
              <Section title="Personal Details" icon={<User className="w-4 h-4" />}>
                <Row label="Date of Birth" value={formatDate(student.dateOfBirth)} />
                <Row label="Gender" value={student.gender} />
                <Row label="Blood Group" value={bloodGroupLabel(student.bloodGroup)} />
                {student.aadharNumber && <Row label="Aadhar No." value={`XXXX XXXX ${student.aadharNumber.slice(-4)}`} />}
                {student.religion && <Row label="Religion" value={student.religion} />}
                {student.caste && <Row label="Caste" value={student.caste} />}
              </Section>

              {/* Admission */}
              <Section title="Admission Details" icon={<FileText className="w-4 h-4" />}>
                <Row label="Admission No." value={student.admissionNumber} mono />
                <Row label="Admission Date" value={formatDate(student.admissionDate)} />
                <Row label="Class" value={classLabel(student.className)} />
                {student.section && <Row label="Section" value={student.section} />}
                <Row label="Academic Year" value={student.academicYear} />
                {student.previousSchool && <Row label="Previous School" value={student.previousSchool} />}
                {student.tcNumber && <Row label="TC Number" value={student.tcNumber} />}
              </Section>

              {/* Parents */}
              {parent && (
                <Section title="Parent / Guardian" icon={<Phone className="w-4 h-4" />}>
                  {parent.fatherName && <Row label="Father" value={parent.fatherName} />}
                  {parent.motherName && <Row label="Mother" value={parent.motherName} />}
                  {parent.guardianName && <Row label="Guardian" value={parent.guardianName} />}
                  {parent.phone && <Row label="Phone" value={parent.phone} />}
                  {parent.alternatePhone && <Row label="Alt. Phone" value={parent.alternatePhone} />}
                  {parent.email && <Row label="Email" value={parent.email} />}
                  {parent.occupation && <Row label="Occupation" value={parent.occupation} />}
                </Section>
              )}

              {/* Address */}
              {parent && (parent.address || parent.city) && (
                <Section title="Address" icon={<MapPin className="w-4 h-4" />}>
                  {parent.address && <Row label="Street" value={parent.address} />}
                  {parent.city && <Row label="City" value={parent.city} />}
                  {parent.district && <Row label="District" value={parent.district} />}
                  {parent.state && <Row label="State" value={parent.state} />}
                  {parent.pincode && <Row label="Pincode" value={parent.pincode} />}
                </Section>
              )}
            </div>

            {student.remarks && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Remarks</p>
                <p className="text-sm text-gray-700">{student.remarks}</p>
              </div>
            )}
          </div>
        </div>

        {/* Documents */}
        {student.documents.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Documents ({student.documents.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {student.documents.map(doc => (
                <a key={doc.id} href={doc.storagePath} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-700">{doc.originalName}</p>
                    <p className="text-xs text-gray-400">{doc.documentType.replace(/_/g, ' ')} · {formatDate(doc.uploadedAt)}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Audit History */}
        {student.auditLogs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Audit History</h3>
            <div className="space-y-2">
              {student.auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700">{log.action}</span>
                    <span className="text-gray-400 mx-1">by</span>
                    <span className="text-gray-600">{log.user?.name || 'System'}</span>
                    <span className="text-gray-400 ml-2 text-xs">{formatDate(log.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-4">
          <p>Guru Shree Vidya Kendra · Digital Record Management System</p>
          <p className="mt-1">Profile generated on {formatDate(new Date())}</p>
        </div>
      </div>
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    gray: 'bg-gray-50 text-gray-600',
  }
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>{children}</span>
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1.5 mb-3 pb-1.5 border-b border-gray-100">
        {icon}{title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-400 text-xs font-medium shrink-0">{label}</span>
      <span className={`text-gray-800 text-right ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
    </div>
  )
}
