'use client'

import { useState, useEffect } from 'react'
import { FileSpreadsheet, Download, Loader2, CheckCircle } from 'lucide-react'
import { CLASSES, ACADEMIC_YEARS } from '@/types'

type ExportType = 'combined' | 'class' | 'year' | 'filtered'

interface ExportOption {
  type: ExportType
  title: string
  description: string
  icon: string
}

const exportOptions: ExportOption[] = [
  { type: 'combined', title: 'Complete Export', description: 'All students across all years and classes', icon: '📊' },
  { type: 'class', title: 'Class-Wise Export', description: 'Export students for a specific class', icon: '🏫' },
  { type: 'year', title: 'Year-Wise Export', description: 'Export students for a specific academic year', icon: '📅' },
  { type: 'filtered', title: 'Filtered Export', description: 'Export with custom class and year filters', icon: '🔍' },
]

export default function ExportsPage() {
  const [selected, setSelected] = useState<ExportType>('combined')
  const [className, setClassName] = useState('')
  const [year, setYear] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastExport, setLastExport] = useState<{ name: string; time: Date } | null>(null)
  const [recentExports, setRecentExports] = useState<Array<{ id: string; fileName: string; exportType: string; rowCount: number; fileSize: number; createdAt: string }>>([])

  useEffect(() => {
    // Load recent exports from API
    fetch('/api/exports/history').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setRecentExports(d)
    }).catch(() => {})
  }, [lastExport])

  async function doExport() {
    setLoading(true)
    try {
      const body: Record<string, unknown> = { type: selected }

      if (selected === 'class') body.className = className
      if (selected === 'year') body.year = year
      if (selected === 'filtered') body.filters = { className: filterClass || undefined, year: filterYear || undefined }

      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Export failed')
      }

      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition') || ''
      const match = contentDisposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] || 'export.xlsx'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      setLastExport({ name: filename, time: new Date() })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const canExport = () => {
    if (selected === 'class') return !!className
    if (selected === 'year') return !!year
    return true
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Excel Exports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate downloadable Excel files with student profile links</p>
      </div>

      {lastExport && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">Export successful!</p>
            <p className="text-sm text-green-600">{lastExport.name} — downloaded at {lastExport.time.toLocaleTimeString()}</p>
          </div>
        </div>
      )}

      {/* Export type selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {exportOptions.map(opt => (
          <button
            key={opt.type}
            onClick={() => setSelected(opt.type)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selected === opt.type
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{opt.icon}</span>
              <div>
                <p className={`font-semibold text-sm ${selected === opt.type ? 'text-blue-800' : 'text-gray-800'}`}>
                  {opt.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
              </div>
              <div className={`ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                selected === opt.type ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
              }`}>
                {selected === opt.type && <div className="w-full h-full rounded-full bg-white scale-50" />}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Options for selected type */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Export Options</h3>

        {selected === 'class' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Select Class *</label>
            <select value={className} onChange={e => setClassName(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Choose a class...</option>
              {CLASSES.map(c => (
                <option key={c} value={c}>{c === 'Nursery' || c === 'LKG' || c === 'UKG' ? c : `Class ${c}`}</option>
              ))}
            </select>
            {className && (
              <p className="text-xs text-gray-400 mt-1.5">File will be named: <code className="bg-gray-100 px-1 rounded">Class_{className}.xlsx</code></p>
            )}
          </div>
        )}

        {selected === 'year' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Select Academic Year *</label>
            <select value={year} onChange={e => setYear(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Choose a year...</option>
              {ACADEMIC_YEARS.slice().reverse().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {year && (
              <p className="text-xs text-gray-400 mt-1.5">File will be named: <code className="bg-gray-100 px-1 rounded">{year.replace('/', '-')}.xlsx</code></p>
            )}
          </div>
        )}

        {selected === 'filtered' && (
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Class (optional)</label>
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Classes</option>
                {CLASSES.map(c => <option key={c} value={c}>{c === 'Nursery' || c === 'LKG' || c === 'UKG' ? c : `Class ${c}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Year (optional)</label>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Years</option>
                {ACADEMIC_YEARS.slice().reverse().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}

        {selected === 'combined' && (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
            <p>Exports all student records. Includes separate worksheets per class plus a master sheet.</p>
            <p className="mt-1 font-medium text-gray-600">Each row contains a clickable profile URL.</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={doExport}
            disabled={loading || !canExport()}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
            ) : (
              <><Download className="w-4 h-4" />Download Excel</>
            )}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <FileSpreadsheet className="w-4 h-4" />
            <span>.xlsx format · includes profile hyperlinks · formatted with school branding</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: '🔗', title: 'Profile Links', desc: 'Every row includes a clickable URL that opens the student profile' },
          { icon: '🎨', title: 'School Branding', desc: 'Excel files include GSVK header and professional formatting' },
          { icon: '📋', title: 'Multiple Sheets', desc: 'Combined export includes class-wise worksheets automatically' },
        ].map(item => (
          <div key={item.title} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3">
            <span className="text-xl">{item.icon}</span>
            <div>
              <p className="font-medium text-sm text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
