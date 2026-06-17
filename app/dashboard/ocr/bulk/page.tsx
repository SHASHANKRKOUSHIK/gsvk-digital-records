'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, XCircle, Loader2, FileImage, ScanLine, Eye } from 'lucide-react'
import Link from 'next/link'
import type { StudentFormData } from '@/types'

interface FileResult {
  fileName: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  jobId?: string
  extractedData?: Partial<StudentFormData>
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
    accept: { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] },
    multiple: true,
    maxSize: 10 * 1024 * 1024,
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

    // Process in batches of 3
    const batchSize = 3
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const fd = new FormData()
      batch.forEach(f => fd.append('files', f))

      // Mark as processing
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

  const successCount = results.filter(r => r.status === 'done').length
  const failCount = results.filter(r => r.status === 'failed').length
  const pendingCount = results.filter(r => r.status === 'pending' || r.status === 'processing').length

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk OCR Upload</h1>
        <p className="text-sm text-gray-500 mt-1">Upload multiple scanned documents to process them all at once</p>
      </div>

      {/* Drop zone */}
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
      }`}>
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">Drop files here or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · Up to 10MB per file · Multiple files supported</p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <p className="font-medium text-sm text-gray-700">{files.length} file{files.length !== 1 ? 's' : ''} selected</p>
            <div className="flex gap-2">
              <button onClick={() => { setFiles([]); setResults([]); setDone(false) }}
                className="text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50">
                Clear all
              </button>
              <button
                onClick={processBulk}
                disabled={processing || files.length === 0}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Processing {progress}%</>
                ) : (
                  <><ScanLine className="w-4 h-4" />Process {files.length} Files</>
                )}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {processing && (
            <div className="px-5 py-2 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
                <span>Processing with Google Vision OCR...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {done && (
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-green-700 font-medium">
                <CheckCircle className="w-4 h-4" />{successCount} successful
              </span>
              {failCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-600 font-medium">
                  <XCircle className="w-4 h-4" />{failCount} failed
                </span>
              )}
              {pendingCount > 0 && <span className="text-gray-500">{pendingCount} pending</span>}
            </div>
          )}

          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {files.map(f => {
              const result = results.find(r => r.fileName === f.name)
              return (
                <div key={f.name} className="flex items-center gap-3 px-5 py-3">
                  <FileImage className="w-8 h-8 text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</p>
                    {result?.error && (
                      <p className="text-xs text-red-500 mt-0.5">{result.error}</p>
                    )}
                    {result?.status === 'done' && result.extractedData?.studentName && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Extracted: {result.extractedData.studentName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!result && (
                      <button onClick={() => removeFile(f.name)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors">✕</button>
                    )}
                    {result?.status === 'pending' && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Pending</span>
                    )}
                    {result?.status === 'processing' && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                        <Loader2 className="w-3 h-3 animate-spin" />Processing
                      </span>
                    )}
                    {result?.status === 'done' && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                        <CheckCircle className="w-3 h-3" />Done
                      </span>
                    )}
                    {result?.status === 'failed' && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
                        <XCircle className="w-3 h-3" />Failed
                      </span>
                    )}
                    {result?.status === 'done' && result.jobId && (
                      <Link href={`/dashboard/ocr?review=${result.jobId}`}
                        className="text-xs flex items-center gap-1 text-blue-600 hover:underline">
                        <Eye className="w-3 h-3" />Review
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h3 className="font-medium text-blue-800 mb-2">How bulk OCR works</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Drop or select multiple scanned admission form images or PDFs</li>
            <li>Click "Process Files" to run Google Vision OCR on all documents</li>
            <li>Files are processed in batches of 3 for reliability</li>
            <li>Review each extracted record and correct errors before saving</li>
          </ol>
        </div>
      )}
    </div>
  )
}
