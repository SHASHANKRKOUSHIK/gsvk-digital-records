'use client'

import { useState, useCallback } from 'react'
import { Search, ExternalLink, Filter, X } from 'lucide-react'
import Link from 'next/link'
import { formatDate, bloodGroupLabel } from '@/lib/utils'
import { CLASSES, ACADEMIC_YEARS } from '@/types'
import type { Student } from '@/types'

// `Omit<Student, 'parents'>` removes the inherited `parents` field (typed as
// full `Parent[]` objects requiring `id`/`studentId`) before redeclaring it
// with this page's narrower shape - TypeScript's `extends` doesn't allow
// directly narrowing an inherited property to an incompatible type, so the
// conflicting field must be omitted first.
interface SearchResult extends Omit<Student, 'parents'> {
  parents?: Array<{ fatherName?: string; motherName?: string; phone?: string; city?: string }>
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [className, setClassName] = useState('')
  const [year, setYear] = useState('')
  const [gender, setGender] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  const doSearch = useCallback(async (p = 1) => {
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (className) params.set('class', className)
      if (year) params.set('year', year)
      if (gender) params.set('gender', gender)
      params.set('page', String(p))

      const res = await fetch(`/api/search?${params}`)
      const data = await res.json()
      setResults(data.data || [])
      setTotal(data.total || 0)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }, [query, className, year, gender])

  function clearFilters() {
    setClassName('')
    setYear('')
    setGender('')
    setQuery('')
    setResults([])
    setSearched(false)
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Students</h1>
        <p className="text-sm text-gray-500 mt-1">Search across all 1999–2026 admission records</p>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(1)}
              placeholder="Search by name, admission number, father, mother, phone, Aadhar..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5 text-sm">
            <Filter className="w-4 h-4" />
            Filters
            {(className || year || gender) && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
          </button>
          <button onClick={() => doSearch(1)} disabled={loading}
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex items-center gap-2">
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Searching...</>
            ) : 'Search'}
          </button>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
            <select value={className} onChange={e => setClassName(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Classes</option>
              {CLASSES.map(c => <option key={c} value={c}>{c === 'Nursery' || c === 'LKG' || c === 'UKG' ? c : `Class ${c}`}</option>)}
            </select>
            <select value={year} onChange={e => setYear(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Years</option>
              {ACADEMIC_YEARS.slice().reverse().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={gender} onChange={e => setGender(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
            {(className || year || gender || query) && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 px-2 py-2 transition-colors">
                <X className="w-4 h-4" /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {searched && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {loading ? 'Searching...' : `${total.toLocaleString()} result${total !== 1 ? 's' : ''} found`}
            </p>
          </div>

          {results.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {results.map(s => (
                <div key={s.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {s.studentName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{s.studentName}</h3>
                          <span className="text-xs font-mono text-gray-400">{s.admissionNumber}</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{s.className}</span>
                          <span className="text-xs text-gray-400">{s.academicYear}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {s.parents?.[0]?.fatherName && <span>Father: <span className="text-gray-700">{s.parents[0].fatherName}</span></span>}
                          {s.parents?.[0]?.motherName && <span>Mother: <span className="text-gray-700">{s.parents[0].motherName}</span></span>}
                          {s.parents?.[0]?.phone && <span>📞 {s.parents[0].phone}</span>}
                          {s.parents?.[0]?.city && <span>📍 {s.parents[0].city}</span>}
                          <span>DOB: {formatDate(s.dateOfBirth)}</span>
                          <span>{bloodGroupLabel(s.bloodGroup)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/dashboard/students/${s.id}/edit`}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
                        Edit
                      </Link>
                      <Link href={`/student/${s.id}`} target="_blank"
                        className="text-xs px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Profile
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="text-center py-16 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No students found</p>
                <p className="text-sm mt-1">Try different keywords or remove filters</p>
              </div>
            )
          )}

          {total > 20 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 20)}</p>
              <div className="flex gap-2">
                {page > 1 && (
                  <button onClick={() => doSearch(page - 1)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">← Prev</button>
                )}
                {page < Math.ceil(total / 20) && (
                  <button onClick={() => doSearch(page + 1)}
                    className="px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">Next →</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="text-center py-20 text-gray-300">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <p className="text-gray-500 font-medium">Enter a search term to find students</p>
          <p className="text-sm text-gray-400 mt-1">Searches across names, IDs, phone numbers, and Aadhar</p>
        </div>
      )}
    </div>
  )
}
