'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ExternalLink, Edit, FileText } from 'lucide-react'
import type { Student } from '@/types'

interface StudentRow extends Student {
  parents?: Array<{ fatherName?: string; motherName?: string; phone?: string }>
}

interface Props {
  students: StudentRow[]
  showActions?: boolean
}

export default function StudentsTable({ students, showActions = true }: Props) {
  if (students.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>No records found</p>
      </div>
    )
  }

  return (
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
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">DOB</th>
            {showActions && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {students.map(s => (
            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                    {s.studentName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{s.studentName}</p>
                    <p className="text-xs text-gray-400">{s.gender}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500 hidden sm:table-cell font-mono text-xs">{s.admissionNumber}</td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                  {s.className}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{s.academicYear}</td>
              <td className="px-4 py-3 text-gray-600 hidden lg:table-cell text-sm">{s.parents?.[0]?.fatherName || '—'}</td>
              <td className="px-4 py-3 text-gray-600 hidden lg:table-cell text-sm">{s.parents?.[0]?.phone || '—'}</td>
              <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell">{formatDate(s.dateOfBirth)}</td>
              {showActions && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/students/${s.id}/edit`}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </Link>
                    <Link href={`/student/${s.id}`} target="_blank"
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
