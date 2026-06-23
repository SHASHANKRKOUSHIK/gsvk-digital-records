'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, ScanLine, CheckCircle, Loader2, FileImage, AlertCircle, Edit } from 'lucide-react'
import StudentForm from '@/components/forms/StudentForm'
import AdmissionPdfUpload from '@/components/forms/AdmissionPdfUpload'
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
  const [ocrPdfFile, setOcrPdfFile] = useState<File | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setError('')
    setOcrPdfFile(null)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] },
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
    setOcrPdfFile(null)
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">OCR Document Upload</h1>
        <p className="text-sm text-gray-500 mt-1">Upload scanned admission forms to automatically extract student data</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {(['upload', 'processing', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-blue-700 text-white' :
              (['processing', 'review', 'done'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-gray-100 text-gray-400'
            }`}>
              {(['processing', 'review', 'done'].indexOf(step) > i) ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${step === s ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
              {s === 'upload' ? 'Upload' : s === 'processing' ? 'Process OCR' : 'Review & Save'}
            </span>
            {i < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}>
            <input {...getInputProps()} />
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-blue-600" />
            </div>
            {file ? (
              <div>
                <div className="flex items-center gap-2 justify-center mb-2">
                  <FileImage className="w-5 h-5 text-blue-600" />
                  <p className="font-medium text-gray-800">{file.name}</p>
                </div>
                <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-gray-700">Drop your admission form here</p>
                <p className="text-sm text-gray-400 mt-1">JPG, PNG, PDF · Max 10 MB</p>
              </div>
            )}
          </div>

          {preview && (
            <img src={preview} alt="Preview" className="w-full rounded-lg object-contain max-h-64 border border-gray-100" />
          )}

          {file && (
            <button onClick={processOcr}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-semibold transition-colors">
              <ScanLine className="w-5 h-5" /> Extract Data with Google Vision OCR
            </button>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="font-semibold text-gray-700">Processing with Google Vision OCR</p>
          <p className="text-sm text-gray-400">Extracting text and mapping fields...</p>
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

          {/* Optional: attach original PDF */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Original Admission Form PDF</h3>
            <p className="text-xs text-gray-400 mb-3">
              Optional — attach the scanned PDF for reference. It will be saved with the student record.
            </p>
            <AdmissionPdfUpload onFileSelected={setOcrPdfFile} />
            {ocrPdfFile && (
              <p className="text-xs text-blue-600 mt-2">
                PDF will be uploaded automatically when you save below.
              </p>
            )}
          </div>

          <StudentForm defaultValues={extractedData} admissionPdfFile={ocrPdfFile} />
        </div>
      )}
    </div>
  )
}
