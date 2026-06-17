import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, QrCode, Download, ExternalLink } from 'lucide-react'
import { getProfileUrl } from '@/lib/utils'
import Image from 'next/image'
import QrRegenerateButton from '@/components/forms/QrRegenerateButton'

export default async function StudentQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, studentName: true, admissionNumber: true, className: true, academicYear: true, qrCode: true },
  })
  if (!student) notFound()

  const profileUrl = getProfileUrl(id)

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/students/${id}`} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">QR Code</h1>
          <p className="text-sm text-gray-500">{student.studentName}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center space-y-5">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
          <QrCode className="w-3.5 h-3.5" />
          Student QR Code
        </div>

        {student.qrCode ? (
          <div>
            <Image
              src={student.qrCode}
              alt="Student QR Code"
              width={220}
              height={220}
              className="mx-auto rounded-2xl border-4 border-gray-100 shadow"
            />
          </div>
        ) : (
          <div className="w-[220px] h-[220px] mx-auto bg-gray-100 rounded-2xl flex items-center justify-center">
            <QrCode className="w-16 h-16 text-gray-300" />
          </div>
        )}

        <div>
          <p className="font-bold text-gray-900 text-lg">{student.studentName}</p>
          <p className="text-sm text-gray-500">{student.admissionNumber} · Class {student.className} · {student.academicYear}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-1">Profile URL</p>
          <a href={profileUrl} target="_blank" className="text-sm text-blue-600 hover:underline break-all inline-flex items-center gap-1">
            {profileUrl} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {student.qrCode && (
            <a
              href={student.qrCode}
              download={`QR_${student.admissionNumber}.png`}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Download PNG
            </a>
          )}
          <QrRegenerateButton studentId={id} />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">Print instructions</p>
        <p className="text-blue-600 text-xs">
          Download the QR code PNG and print it on the student's ID card or admission file.
          Scanning the QR code opens the student's public profile page instantly.
        </p>
      </div>
    </div>
  )
}
