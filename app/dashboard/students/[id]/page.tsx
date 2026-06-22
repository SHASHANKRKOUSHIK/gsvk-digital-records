import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatDateTime, bloodGroupLabel } from '@/lib/utils'
import { Edit, ExternalLink, Download, FileText, Clock, QrCode, FileDown } from 'lucide-react'
import Image from 'next/image'
import AdmissionPdfUpload from '@/components/forms/AdmissionPdfUpload'

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      parents: true,
      documents: { orderBy: { uploadedAt: 'desc' } },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  })

  if (!student) notFound()
  const parent = student.parents[0]

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
            {student.studentName[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{student.studentName}</h1>
            <p className="text-sm text-gray-500 font-mono">{student.admissionNumber} · Class {student.className} · {student.academicYear}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/student/${id}`} target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Public Profile
          </Link>
          <a href={`/api/students/${id}/pdf`}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" /> PDF
          </a>
          <Link href={`/dashboard/students/${id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors">
            <Edit className="w-3.5 h-3.5" /> Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Personal */}
          <Card title="Personal Details">
            <Grid>
              <Field label="Student Name" value={student.studentName} />
              <Field label="Gender" value={student.gender} />
              <Field label="Date of Birth" value={formatDate(student.dateOfBirth)} />
              <Field label="Place of Birth" value={student.placeOfBirth || '—'} />
              <Field label="Blood Group" value={bloodGroupLabel(student.bloodGroup)} />
              <Field label="Aadhar No." value={student.aadharNumber ? `XXXX XXXX ${student.aadharNumber.slice(-4)}` : '—'} />
              <Field label="Mother Tongue" value={student.motherTongue || '—'} />
              <Field label="Siblings" value={student.siblings || '—'} />
              <Field label="Religion" value={student.religion || '—'} />
              <Field label="Caste" value={student.caste || '—'} />
            </Grid>
          </Card>

          {/* Admission */}
          <Card title="Admission Details">
            <Grid>
              <Field label="Admission No." value={student.admissionNumber} mono />
              <Field label="Admission Date" value={formatDate(student.admissionDate)} />
              <Field label="Class" value={`Class ${student.className}`} />
              <Field label="Section" value={student.section || '—'} />
              <Field label="Academic Year" value={student.academicYear} />
              <Field label="Previous School" value={student.previousSchool || '—'} />
              <Field label="TC Number" value={student.tcNumber || '—'} />
              <Field label="PEN No." value={student.penNumber || '—'} />
              <Field label="SATS No." value={student.satsNumber || '—'} />
              <Field label="Apaar ID No." value={student.apaarId || '—'} />
            </Grid>
            {student.remarks && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Remarks</p>
                <p className="text-sm text-gray-700">{student.remarks}</p>
              </div>
            )}
          </Card>

          {/* Parents */}
          {parent && (
            <Card title="Parent / Guardian">
              <Grid>
                <Field label="Father" value={parent.fatherName || '—'} />
                <Field label="Mother" value={parent.motherName || '—'} />
                <Field label="Guardian" value={parent.guardianName || '—'} />
                <Field label="Phone" value={parent.phone || '—'} />
                <Field label="Alt. Phone" value={parent.alternatePhone || '—'} />
                <Field label="Email" value={parent.email || '—'} />
                <Field label="Occupation" value={parent.occupation || '—'} />
                <Field label="Annual Income" value={parent.annualIncome || '—'} />
              </Grid>
              {(parent.address || parent.city) && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">Present Address</p>
                  <p className="text-sm text-gray-700">
                    {[parent.address, parent.city, parent.district, parent.state, parent.pincode].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
              {parent.permanentAddress && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">Permanent Address</p>
                  <p className="text-sm text-gray-700">{parent.permanentAddress}</p>
                </div>
              )}
            </Card>
          )}

          {/* Documents */}
          <Card title={`Documents (${student.documents.length})`}>
            {student.documents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No documents uploaded</p>
            ) : (
              <div className="space-y-2">
                {student.documents.map(doc => (
                  <a key={doc.id} href={doc.storagePath} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">
                    <FileText className="w-8 h-8 text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-700">{doc.originalName}</p>
                      <p className="text-xs text-gray-400">{doc.documentType} · {formatDate(doc.uploadedAt)}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* QR Code */}
          {student.qrCode && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center justify-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" /> QR Code
              </p>
              <Image src={student.qrCode} alt="QR Code" width={140} height={140} className="mx-auto rounded-lg border border-gray-100" />
              <p className="text-xs text-gray-400 mt-2">Scan to open student profile</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Record Info</p>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">Created</p>
                <p className="text-gray-700">{formatDateTime(student.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Last Updated</p>
                <p className="text-gray-700">{formatDateTime(student.updatedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${student.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Admission Form PDF */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FileDown className="w-3.5 h-3.5" /> Admission Form PDF
            </p>
            <AdmissionPdfUpload
              studentId={id}
              existingPdfUrl={student.admissionFormPdfUrl}
            />
          </div>

          {/* Audit log */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Audit History
            </p>
            {student.auditLogs.length === 0 ? (
              <p className="text-xs text-gray-400">No audit records</p>
            ) : (
              <div className="space-y-3">
                {student.auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-gray-700 font-medium">{log.action} by {log.user?.name || 'System'}</p>
                      <p className="text-gray-400">{formatDateTime(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-4 pb-2 border-b border-gray-100">{title}</h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={`text-sm text-gray-800 mt-0.5 ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</p>
    </div>
  )
}
