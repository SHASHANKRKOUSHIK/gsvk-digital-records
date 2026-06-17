import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import DocumentUploadClient from '@/components/forms/DocumentUploadClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function StudentDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const student = await prisma.student.findUnique({
    where: { id },
    include: { documents: { orderBy: { uploadedAt: 'desc' } } },
  })
  if (!student) notFound()

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/students/${id}`}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500">{student.studentName} — {student.admissionNumber}</p>
        </div>
      </div>

      <DocumentUploadClient
        studentId={id}
        existingDocuments={student.documents.map(d => ({
          id: d.id,
          originalName: d.originalName,
          storagePath: d.storagePath,
          documentType: d.documentType,
          fileSize: d.fileSize,
          uploadedAt: d.uploadedAt.toISOString(),
          mimeType: d.mimeType,
        }))}
      />
    </div>
  )
}
