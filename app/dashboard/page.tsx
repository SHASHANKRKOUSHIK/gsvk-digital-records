import { prisma } from '@/lib/prisma'
import { Users, BookOpen, TrendingUp, ScanLine, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import DashboardCharts from '@/components/charts/DashboardCharts'

async function getDashboardData() {
  const [
    totalStudents,
    totalAdmissions,
    byYear,
    byClass,
    recentStudents,
    ocrStats,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.student.count(),
    prisma.student.groupBy({ by: ['academicYear'], _count: { id: true }, orderBy: { academicYear: 'asc' } }),
    prisma.student.groupBy({ by: ['className'], _count: { id: true }, orderBy: { className: 'asc' } }),
    prisma.student.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { parents: { take: 1 } },
    }),
    prisma.ocrJob.groupBy({ by: ['status'], _count: { id: true } }),
  ])

  const currentYear = new Date().getFullYear()
  const currentYearStr = `${currentYear}-${String(currentYear + 1).slice(2)}`
  const thisYearCount = await prisma.student.count({ where: { academicYear: currentYearStr } })

  return { totalStudents, totalAdmissions, thisYearCount, byYear, byClass, recentStudents, ocrStats }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const ocrPending = data.ocrStats.find(s => s.status === 'PENDING')?._count.id || 0
  const ocrCompleted = data.ocrStats.find(s => s.status === 'COMPLETED')?._count.id || 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Guru Shree Vidya Kendra — Admission Records Overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-600" />}
          label="Active Students"
          value={data.totalStudents.toLocaleString()}
          bg="bg-blue-50"
          sub="All time records"
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-emerald-600" />}
          label="This Year"
          value={data.thisYearCount.toLocaleString()}
          bg="bg-emerald-50"
          sub="Current academic year"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-violet-600" />}
          label="Total Admissions"
          value={data.totalAdmissions.toLocaleString()}
          bg="bg-violet-50"
          sub="Since 1999"
        />
        <StatCard
          icon={<ScanLine className="w-5 h-5 text-amber-600" />}
          label="OCR Pending"
          value={ocrPending.toLocaleString()}
          bg="bg-amber-50"
          sub={`${ocrCompleted} completed`}
        />
      </div>

      {/* Charts */}
      <DashboardCharts
        byYear={data.byYear.map(r => ({ year: r.academicYear, count: r._count.id }))}
        byClass={data.byClass.map(r => ({ className: r.className, count: r._count.id }))}
      />

      {/* Recent students */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Recent Admissions
          </h2>
          <Link href="/dashboard/students" className="text-xs text-blue-600 hover:underline font-medium">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Adm. No</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Class</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Father</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.recentStudents.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                        {s.studentName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{s.studentName}</p>
                        <p className="text-xs text-gray-400">{s.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-gray-600 hidden sm:table-cell font-mono text-xs">{s.admissionNumber}</td>
                  <td className="px-6 py-3 hidden md:table-cell">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      Class {s.className}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600 hidden lg:table-cell text-sm">
                    {s.parents[0]?.fatherName || '—'}
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs">{formatDate(s.createdAt)}</td>
                  <td className="px-6 py-3">
                    <Link href={`/student/${s.id}`} target="_blank"
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.recentStudents.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No students yet. <Link href="/dashboard/students/new" className="text-blue-600 hover:underline">Add the first one</Link></p>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/dashboard/students/new', label: 'New Admission', icon: '📝', color: 'border-blue-200 hover:bg-blue-50' },
          { href: '/dashboard/ocr', label: 'OCR Upload', icon: '🔍', color: 'border-green-200 hover:bg-green-50' },
          { href: '/dashboard/ocr/bulk', label: 'Bulk Upload', icon: '📦', color: 'border-purple-200 hover:bg-purple-50' },
          { href: '/dashboard/exports', label: 'Export Excel', icon: '📊', color: 'border-amber-200 hover:bg-amber-50' },
        ].map(action => (
          <Link
            key={action.href}
            href={action.href}
            className={`bg-white border ${action.color} rounded-xl p-4 text-center transition-colors`}
          >
            <div className="text-2xl mb-1">{action.icon}</div>
            <p className="text-sm font-medium text-gray-700">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, bg, sub }: { icon: React.ReactNode; label: string; value: string; bg: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
