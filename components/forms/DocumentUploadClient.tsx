'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Trash2, ExternalLink, Loader2, CheckCircle } from 'lucide-react'
import { formatDate, formatFileSize } from '@/lib/utils'

type DocumentType = 'ADMISSION_FORM' | 'BIRTH_CERTIFICATE' | 'TRANSFER_CERTIFICATE' | 'MARK_SHEET' | 'PHOTO' | 'AADHAR' | 'OTHER'

interface ExistingDoc {
  id: string
  originalName: string
  storagePath: string
  documentType: string
  fileSize: number | null
  uploadedAt: string
  mimeType: string | null
}

interface Props {
  studentId: string
  existingDocuments: ExistingDoc[]
}

const DOCTYPE_LABELS: Record<DocumentType, string> = {
  ADMISSION_FORM: 'Admission Form',
  BIRTH_CERTIFICATE: 'Birth Certificate',
  TRANSFER_CERTIFICATE: 'Transfer Certificate',
  MARK_SHEET: 'Mark Sheet',
  PHOTO: 'Photograph',
  AADHAR: 'Aadhar Card',
  OTHER: 'Other',
}

export default function DocumentUploadClient({ studentId, existingDocuments }: Props) {
  const [docs, setDocs] = useState<ExistingDoc[]>(existingDocuments)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState<DocumentType>('ADMISSION_FORM')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadDone, setUploadDone] = useState(false)
  const [error, setError] = useState('')

  const onDrop = useCallback((accepted: File[]) => {
    setPendingFiles(prev => [...prev, ...accepted])
    setUploadDone(false)
    setError('')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024,
  })

  async function uploadFiles() {
    if (!pendingFiles.length) return
    setUploading(true)
    setError('')

    const newDocs: ExistingDoc[] = []
    for (const file of pendingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('studentId', studentId)
      fd.append('documentType', docType)

      try {
        const res = await fetch('/api/documents', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        newDocs.push({
          id: data.id,
          originalName: file.name,
          storagePath: data.url,
          documentType: docType,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          mimeType: file.type,
        })
      } catch (err) {
        setError(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : err}`)
      }
    }

    setDocs(prev => [...newDocs, ...prev])
    setPendingFiles([])
    setUploadDone(true)
    setUploading(false)
  }

  function removePending(name: string) {
    setPendingFiles(prev => prev.filter(f => f.name !== name))
  }

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Upload Documents</h2>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600 shrink-0">Document Type</label>
          <select
            value={docType}
            onChange={e => setDocType(e.target.value as DocumentType)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(DOCTYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">Drop files or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · Max 10MB each</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        )}

        {uploadDone && !error && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4" /> Documents uploaded successfully
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="space-y-2">
            {pendingFiles.map(f => (
              <div key={f.name} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <FileText className="w-6 h-6 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(f.size)}</p>
                </div>
                <button onClick={() => removePending(f.name)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={uploadFiles}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</>
              ) : (
                <><Upload className="w-4 h-4" />Upload {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Existing documents */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Uploaded Documents ({docs.length})</h2>
        </div>
        {docs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{doc.originalName}</p>
                  <p className="text-xs text-gray-400">
                    {DOCTYPE_LABELS[doc.documentType as DocumentType] || doc.documentType}
                    {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                    {` · ${formatDate(doc.uploadedAt)}`}
                  </p>
                </div>
                <a
                  href={doc.storagePath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
