'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, ScanLine, CheckCircle, Loader2, FileImage, AlertCircle, Edit } from 'lucide-react'
import StudentForm from '@/components/forms/StudentForm'
import type { StudentFormData } from '@/types'

type Step = 'upload' | 'processing' | 'review' | 'done'

export default function OcrPage() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<Partial<StudentFormData>>({})
  const [rawText, setRawText] = useState('')
  const [error, setError] = useState('')
  const [jobId, setJobId] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setError('')
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  async function processOcr() {
    if (!file) return
    setStep('processing')
    setError('')

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'OCR failed')
      setExtractedData(data.extractedData || {})
      setRawText(data.rawText || '')
      setJobId(data.jobId || '')
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR processing failed')
      setStep('upload')
    }
  }

  function reset() {
    setStep('upload')
    setFile(null)
    setPreview(null)
    setExtractedData({})
    setRawText('')
    setError('')
    setJobId('')
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">OCR Document Upload</h1>
        <p className="text-sm text-gray-500 mt-1">Upload scanned admission forms to automatically extract student data</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(['upload', 'processing', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step === s ? 'bg-blue-700 text-white' :
              (['processing', 'review', 'done'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {(['processing', 'review', 'done'].indexOf(step) > i) ? '✓' : i + 1}
            </div>
            <span className={step === s ? 'text-blue-700' : 'text-gray-400'}>
              {s === 'upload' ? 'Upload' : s === 'processing' ? 'Process OCR' : 'Review & Save'}
            </span>
            {i < 2 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {step === 'upload' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}>
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-600">Drop file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF up to 10MB</p>
            </div>

            {file && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
                <FileImage className="w-8 h-8 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={processOcr}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <ScanLine className="w-4 h-4" />
                  Extract Data
                </button>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-100 p-5">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full rounded-lg object-contain max-h-64" />
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                <FileImage className="w-12 h-12 mb-2" />
                <p className="text-sm">File preview</p>
              </div>
            )}
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              <p className="font-semibold text-gray-600">Supported fields:</p>
              <div className="grid grid-cols-2 gap-1">
                {['Student Name', 'Admission No.', 'Date of Birth', 'Father Name', 'Mother Name', 'Phone', 'Class', 'Address', 'Blood Group', 'Aadhar No.'].map(f => (
                  <div key={f} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-800 text-lg">Processing with Google Vision OCR</h3>
          <p className="text-sm text-gray-500 mt-2">Extracting text and mapping fields...</p>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-800">OCR extraction complete</p>
              <p className="text-sm text-green-700 mt-0.5">Review and correct the extracted data below before saving.</p>
              <div className="flex gap-3 mt-2">
                <button onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-green-700 underline hover:no-underline">
                  {showRaw ? 'Hide' : 'Show'} raw OCR text
                </button>
                <button onClick={reset} className="text-xs text-gray-500 underline hover:no-underline">
                  Start over
                </button>
              </div>
            </div>
          </div>

          {showRaw && rawText && (
            <div className="bg-gray-900 text-green-400 rounded-xl p-4 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
              {rawText}
            </div>
          )}

          <div className="bg-white rounded-xl border border-amber-200 p-4 flex items-start gap-2">
            <Edit className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">Pre-filled from OCR. Please review all fields carefully before saving.</p>
          </div>

          <StudentForm defaultValues={extractedData} />
        </div>
      )}
    </div>
  )
}
