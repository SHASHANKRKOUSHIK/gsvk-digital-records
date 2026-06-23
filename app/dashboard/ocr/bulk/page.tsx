'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, XCircle, Loader2, FileImage, ScanLine, Eye, Info } from 'lucide-react'
import Link from 'next/link'

interface FileResult {
  fileName: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  jobId?: string
  extractedData?: Record<string, unknown>
  error?: string
}

export default function BulkOcrPage() {
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<FileResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...accepted.filter(f => !names.has(f.name))]
    })
    setDone(false)
    setResults([])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  })

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  async function processBulk() {
    if (!files.length) return
    setProcessing(true)
    setDone(false)
    setProgress(0)

    const initialResults: FileResult[] = files.map(f => ({ fileName: f.name, status: 'pending' }))
    setResults(initialResults)

    const batchSize = 3
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const fd = new FormData()
      batch.forEach(f => fd.append('files', f))

      setResults(prev => prev.map(r =>
        batch.some(f => f.name === r.fileName) ? { ...r, status: 'processing' } : r
      ))

      try {
        const res = await fetch('/api/ocr/bulk', { method: 'POST', body: fd })
        const data = await res.json()

        if (data.results) {
          setResults(prev => prev.map(r => {
            const match = data.results.find((dr: { fileName: string }) => dr.fileName === r.fileName)
            if (!match) return r
            return {
              ...r,
              status: match.status === 'REVIEW' ? 'done' : 'failed',
              jobId: match.jobId,
              extractedData: match.extractedData,
              error: match.error,
            }
          }))
        }
      } catch (err) {
        setResults(prev => prev.map(r =>
          batch.some(f => f.name === r.fileName) ? { ...r, status: 'failed', error: String(err) } : r
        ))
      }

      setProgress(Math.round(((i + batch.length) / files.length) * 100))
    }

    setProcessing(false)
    setDone(true)
  }

  const doneCount = results.filter(r => r.status === 'done').length
  const failedCount = results.filter(r => r.status === 'failed').length

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk OCR Upload</h1>
        <p className="text-sm text-gray-500 mt-1">Upload multiple scanned forms at once — powered by Google Vision OCR</p>
      </div>

      {/* Drop zone */}
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
      }`}>
        <input {...getInputProps()} />
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <Upload className="w-7 h-7 text-blue-600" />
        </div>
        <p className="font-semibold text-gray-700">Drop admission form images here</p>
        <p className="text-sm text-gray-400 mt-1">JPG, PNG, PDF · Up to 10MB per file · Multiple files supported</p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">{files.length} file{files.length > 1 ? 's' : ''} selected</p>
            <button
              onClick={() => { setFiles([]); setResults([]); setDone(false) }}
              className="text-xs text-red-500 hover:text-red-700">
              Clear all
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map(f => {
              const result = results.find(r => r.fileName === f.name)
              return (
                <div key={f.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <FileImage className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</p>
                  </div>
                  {!result && (
                    <button onClick={() => removeFile(f.name)}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0">Remove</button>
                  )}
                  {result?.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
                  {result?.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                  {result?.status === 'failed' && (
                    <span title={result.error} className="flex items-center gap-1 text-xs text-red-500 shrink-0">
                      <XCircle className="w-4 h-4" /> Failed
                    </span>
                  )}
                  {result?.status === 'done' && result.jobId && (
                    <Link href={`/dashboard/ocr/jobs?highlight=${result.jobId}`}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                      <Eye className="w-3.5 h-3.5" /> Review
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {processing && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Processing with Google Vision OCR...</p>
            <p className="text-sm text-gray-400">{progress}%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Summary */}
      {done && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          failedCount === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}>
          {failedCount === 0
            ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            : <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          }
          <div>
            <p className={`font-medium text-sm ${failedCount === 0 ? 'text-green-800' : 'text-amber-800'}`}>
              {doneCount} of {files.length} files processed successfully
              {failedCount > 0 && ` · ${failedCount} failed`}
            </p>
            <p className="text-xs mt-1 text-gray-500">
              Go to <Link href="/dashboard/ocr/jobs" className="underline text-blue-600">OCR Jobs</Link> to review and save each extracted record.
            </p>
          </div>
        </div>
      )}

      {/* Process button */}
      {files.length > 0 && !processing && !done && (
        <button onClick={processBulk}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-semibold transition-colors">
          <ScanLine className="w-5 h-5" /> Process {files.length} file{files.length > 1 ? 's' : ''} with Google Vision OCR
        </button>
      )}

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h3 className="font-medium text-blue-800 mb-2 text-sm">How bulk OCR works</h3>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Upload multiple scanned admission form images or PDFs</li>
          <li>Google Vision OCR extracts text from each form automatically</li>
          <li>Go to OCR Jobs to review each record, correct any errors, and save</li>
          <li>Attach the original PDF to each student record during review</li>
        </ol>
      </div>
    </div>
  )
}
