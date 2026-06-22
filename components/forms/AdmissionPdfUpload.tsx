'use client'

import { useState, useRef } from 'react'
import { FileText, Upload, X, CheckCircle, Loader2, Eye, Trash2 } from 'lucide-react'

interface Props {
  /** If set, this component uploads directly to the API for an existing student */
  studentId?: string
  /** If set, shown as the currently stored PDF (for the detail-page use case) */
  existingPdfUrl?: string | null
  /** Called when a file is selected locally (for the form use case — upload happens after save) */
  onFileSelected?: (file: File | null) => void
  /** Called after a successful direct upload (for the detail-page use case) */
  onUploaded?: (url: string) => void
}

export default function AdmissionPdfUpload({
  studentId,
  existingPdfUrl,
  onFileSelected,
  onUploaded,
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingPdfUrl || null)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<{ original: number; compressed: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    setError('')
    setStats(null)

    if (!file) return

    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large (max 20 MB)')
      return
    }

    setSelectedFile(file)
    onFileSelected?.(file)
  }

  function handleRemoveSelected() {
    setSelectedFile(null)
    setError('')
    setStats(null)
    onFileSelected?.(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  // Direct upload — only used when studentId is provided (detail page or post-save)
  async function handleUpload() {
    if (!selectedFile || !studentId) return
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await fetch(`/api/students/${studentId}/admission-pdf`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setUploadedUrl(data.publicUrl)
      setStats({ original: data.originalSize, compressed: data.compressedSize })
      setSelectedFile(null)
      if (inputRef.current) inputRef.current.value = ''
      onUploaded?.(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!studentId || !uploadedUrl) return
    setUploading(true)
    try {
      const res = await fetch(`/api/students/${studentId}/admission-pdf`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setUploadedUrl(null)
      setStats(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Already uploaded */}
      {uploadedUrl && !selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">Admission form PDF uploaded</p>
            {stats && (
              <p className="text-xs text-green-600 mt-0.5">
                Compressed {formatSize(stats.original)} → {formatSize(stats.compressed)}
                {' '}({Math.round((1 - stats.compressed / stats.original) * 100)}% smaller)
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a href={uploadedUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium px-2 py-1.5 rounded-lg hover:bg-green-100 transition-colors">
              <Eye className="w-3.5 h-3.5" /> View
            </a>
            {studentId && (
              <button onClick={() => inputRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <Upload className="w-3.5 h-3.5" /> Replace
              </button>
            )}
            {studentId && (
              <button onClick={handleDelete} disabled={uploading}
                className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* File selected, not yet uploaded */}
      {selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-800 truncate">{selectedFile.name}</p>
            <p className="text-xs text-blue-600">{formatSize(selectedFile.size)} · Will be compressed on upload</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Direct upload button only shown when studentId is available */}
            {studentId && (
              <button onClick={handleUpload} disabled={uploading}
                className="inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60">
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                  : <><Upload className="w-3.5 h-3.5" /> Upload</>
                }
              </button>
            )}
            <button onClick={handleRemoveSelected} disabled={uploading}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Drop zone — shown when no file is selected and no existing PDF */}
      {!selectedFile && !uploadedUrl && (
        <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
            <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              {uploadedUrl ? 'Replace admission form PDF' : 'Upload original admission form PDF'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              PDF only · Max 20 MB · Auto-compressed on save
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}

      {/* Replace drop zone when PDF exists but no file selected yet */}
      {!selectedFile && uploadedUrl && (
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      )}

      {error && (
        <p className="text-red-600 text-xs flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> {error}
        </p>
      )}
    </div>
  )
}
