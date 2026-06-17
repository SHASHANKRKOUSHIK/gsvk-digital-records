import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { ScanLine, CheckCircle, XCircle, Clock, Eye, AlertCircle } from 'lucide-react'

const STATUS_CONFIG = {
  PENDING:    { label: 'Pending',    color: 'bg-gray-100 text-gray-600',    icon: Clock },
  PROCESSING: { label: 'Processing', color: 'bg-blue-50 text-blue-700',     icon: ScanLine },
  COMPLETED:  { label: 'Completed',  color: 'bg-green-50 text-green-700',   icon: CheckCircle },
  REVIEW:     { label: 'Review',     color: 'bg-amber-50 text-amber-700',   icon: AlertCircle },
  FAILED:     { label: 'Failed',     color: 'bg-red-50 text-red-600',       icon: XCircle },
}

export default async function OcrJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const page = parseInt(params.page || '1')
  const limit = 20
  const statusFilter = params.status || ''

  const where: Record<string, unknown> = {}
  if (statusFilter) where.status = statusFilter
  // Operators only see their own; super admins see all
  if (user.role !== 'SUPER_ADMIN') where.userId = user.id

  const [jobs, total] = await Promise.all([
    prisma.ocrJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { name: true } },
        student: { select: { studentName: true, admissionNumber: true } },
      },
    }),
    prisma.ocrJob.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)
  const statusCounts = await prisma.ocrJob.groupBy({ by: ['status'], _count: { id: true } })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">OCR Job History</h1>
        <p className="text-sm text-gray-500 mt-1">{total} total jobs</p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/ocr/jobs"
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!statusFilter ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All ({total})
        </Link>
        {statusCounts.map(sc => {
          const cfg = STATUS_CONFIG[sc.status as keyof typeof STATUS_CONFIG]
          return (
            <Link
              key={sc.status}
              href={`/dashboard/ocr/jobs?status=${sc.status}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === sc.status ? 'bg-blue-700 text-white' : `${cfg?.color} hover:opacity-80`}`}
            >
              {cfg?.label || sc.status} ({sc._count.id})
            </Link>
          )
        })}
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">File</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Operator</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map(job => {
                const cfg = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG]
                const Icon = cfg?.icon || Clock
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ScanLine className="w-4 h-4 text-gray-300 shrink-0" />
                        <p className="text-gray-700 font-medium truncate max-w-[180px]">{job.fileName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg?.label || job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {job.student ? (
                        <Link href={`/dashboard/students/${job.student.studentName}`} className="text-blue-600 hover:underline text-xs">
                          {job.student.studentName}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">Not linked</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{job.user?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{formatDateTime(job.createdAt)}</td>
                    <td className="px-4 py-3">
                      {job.status === 'REVIEW' && (
                        <Link
                          href={`/dashboard/ocr?review=${job.id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Eye className="w-3 h-3" /> Review
                        </Link>
                      )}
                      {job.status === 'FAILED' && job.errorMessage && (
                        <span className="text-xs text-red-500 truncate max-w-[120px] block" title={job.errorMessage}>
                          {job.errorMessage.slice(0, 40)}…
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className="text-center py-14 text-gray-400">
              <ScanLine className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No OCR jobs found</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <p className="text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?status=${statusFilter}&page=${page - 1}`}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">← Prev</Link>
              )}
              {page < totalPages && (
                <Link href={`?status=${statusFilter}&page=${page + 1}`}
                  className="px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800">Next →</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
