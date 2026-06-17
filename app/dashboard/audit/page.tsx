import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { History, ExternalLink } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700',
  UPDATE: 'bg-blue-50 text-blue-700',
  DELETE: 'bg-red-50 text-red-600',
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>
}) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const page = parseInt(params.page || '1')
  const limit = 30
  const actionFilter = params.action || ''

  const where: Record<string, unknown> = {}
  if (actionFilter) where.action = actionFilter
  if (user.role !== 'SUPER_ADMIN') where.userId = user.id

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
        student: { select: { id: true, studentName: true, admissionNumber: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()} total entries</p>
      </div>

      {/* Action filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'CREATE', 'UPDATE', 'DELETE'].map(a => (
          <Link
            key={a}
            href={`/dashboard/audit${a ? `?action=${a}` : ''}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              actionFilter === a
                ? 'bg-blue-700 text-white'
                : a
                ? `${ACTION_COLORS[a] || 'bg-gray-100 text-gray-600'} hover:opacity-80`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {a || 'All'} {!a && `(${total})`}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Performed By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.student ? (
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{log.student.studentName}</p>
                          <p className="text-xs text-gray-400 font-mono">{log.student.admissionNumber}</p>
                        </div>
                        <Link href={`/student/${log.student.id}`} target="_blank" className="text-blue-400 hover:text-blue-600">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-gray-700 text-sm">{log.user?.name || '—'}</p>
                    <p className="text-gray-400 text-xs">{log.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-500 font-mono">{log.entity}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {logs.length === 0 && (
            <div className="text-center py-14 text-gray-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No audit records found</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <p className="text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?action=${actionFilter}&page=${page - 1}`}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">← Prev</Link>
              )}
              {page < totalPages && (
                <Link href={`?action=${actionFilter}&page=${page + 1}`}
                  className="px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800">Next →</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
