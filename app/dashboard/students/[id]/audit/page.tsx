import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700 border-green-100',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-100',
  DELETE: 'bg-red-50 text-red-600 border-red-100',
}

export default async function StudentAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, studentName: true, admissionNumber: true },
  })
  if (!student) notFound()

  const logs = await prisma.auditLog.findMany({
    where: { studentId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  })

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/students/${id}`} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit History</h1>
          <p className="text-sm text-gray-500">{student.studentName} — {student.admissionNumber}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No audit records found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log, idx) => (
              <div key={log.id} className="flex gap-4 px-5 py-4">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                    {log.action[0]}
                  </div>
                  {idx < logs.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-2" />}
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                        {log.action}
                      </span>
                      <span className="text-gray-500 text-sm mx-2">·</span>
                      <span className="text-sm text-gray-700 font-medium">{log.entity}</span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    By <span className="font-medium text-gray-700">{log.user?.name || 'System'}</span>
                    <span className="text-gray-400 ml-1">({log.user?.email})</span>
                  </p>
                  {(log.oldData || log.newData) && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View changes</summary>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {log.oldData && (
                          <div className="bg-red-50 border border-red-100 rounded p-2">
                            <p className="font-semibold text-red-700 mb-1">Before</p>
                            <pre className="text-red-600 whitespace-pre-wrap break-all">{JSON.stringify(log.oldData, null, 2)}</pre>
                          </div>
                        )}
                        {log.newData && (
                          <div className="bg-green-50 border border-green-100 rounded p-2">
                            <p className="font-semibold text-green-700 mb-1">After</p>
                            <pre className="text-green-700 whitespace-pre-wrap break-all">{JSON.stringify(log.newData, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
