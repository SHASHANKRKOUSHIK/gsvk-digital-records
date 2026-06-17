import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { UserPlus, Search } from 'lucide-react'
import { getServerUser } from '@/lib/auth'
import DeleteStudentButton from '@/components/forms/DeleteStudentButton'

interface PageProps {
  searchParams: Promise<{ page?: string; class?: string; year?: string; q?: string }>
}

export default async function StudentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const currentUser = await getServerUser()
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const page = parseInt(params.page || '1')
  const limit = 20
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { isActive: true }
  if (params.class) where.className = params.class
  if (params.year) where.academicYear = params.year
  if (params.q) {
    where.OR = [
      { studentName: { contains: params.q, mode: 'insensitive' } },
      { admissionNumber: { contains: params.q, mode: 'insensitive' } },
      { parents: { some: { fatherName: { contains: params.q, mode: 'insensitive' } } } },
    ]
  }

  const [students, total, classes, years] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { parents: { take: 1 } },
    }),
    prisma.student.count({ where }),
    prisma.student.findMany({ select: { className: true }, distinct: ['className'], orderBy: { className: 'asc' } }),
    prisma.student.findMany({ select: { academicYear: true }, distinct: ['academicYear'], orderBy: { academicYear: 'desc' } }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} records found</p>
        </div>
        <Link href="/dashboard/students/new"
          className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <UserPlus className="w-4 h-4" /> New Admission
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Name, Adm No, Father..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select name="class" defaultValue={params.class}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.className} value={c.className}>Class {c.className}</option>)}
        </select>
        <select name="year" defaultValue={params.year}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Years</option>
          {years.map(y => <option key={y.academicYear} value={y.academicYear}>{y.academicYear}</option>)}
        </select>
        <button type="submit"
          className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors">
          Filter
        </button>
        <Link href="/dashboard/students"
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
          Clear
        </Link>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Adm. No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Class</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Year</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Father</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Admitted</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                        {s.studentName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 whitespace-nowrap">{s.studentName}</p>
                        <p className="text-xs text-gray-400">{s.gender} · {s.section ? `Sec ${s.section}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell font-mono text-xs">{s.admissionNumber}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {s.className}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell">{s.academicYear}</td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell text-sm">{s.parents[0]?.fatherName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell text-sm">{s.parents[0]?.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell">{formatDate(s.admissionDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/students/${s.id}/edit`}
                        className="text-xs text-gray-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                        Edit
                      </Link>
                      <Link href={`/student/${s.id}`} target="_blank"
                        className="text-xs text-blue-600 hover:underline font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                        View
                      </Link>
                      {isSuperAdmin && (
                        <DeleteStudentButton studentId={s.id} studentName={s.studentName} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No students found</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <p className="text-gray-500">Showing {skip + 1}–{Math.min(skip + limit, total)} of {total}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?page=${page - 1}&class=${params.class || ''}&year=${params.year || ''}&q=${params.q || ''}`}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">← Prev</Link>
              )}
              {page < totalPages && (
                <Link href={`?page=${page + 1}&class=${params.class || ''}&year=${params.year || ''}&q=${params.q || ''}`}
                  className="px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800">Next →</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
