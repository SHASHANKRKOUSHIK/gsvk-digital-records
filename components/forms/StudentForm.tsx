'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CLASSES, ACADEMIC_YEARS, BLOOD_GROUP_LABELS, BLOOD_GROUPS } from '@/types'
import type { StudentFormData } from '@/types'
import { Loader2, AlertTriangle } from 'lucide-react'
import AdmissionPdfUpload from '@/components/forms/AdmissionPdfUpload'

const schema = z.object({
  admissionNumber: z.string().min(1, 'Required'),
  admissionDate: z.string().min(1, 'Required'),
  studentName: z.string().min(2, 'Required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dateOfBirth: z.string().min(1, 'Required'),
  bloodGroup: z.enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN']),
  aadharNumber: z.string().optional(),
  className: z.string().min(1, 'Required'),
  section: z.string().optional(),
  academicYear: z.string().min(1, 'Required'),
  religion: z.string().optional(),
  caste: z.string().optional(),
  previousSchool: z.string().optional(),
  tcNumber: z.string().optional(),
  remarks: z.string().optional(),
  placeOfBirth: z.string().optional(),
  siblings: z.string().optional(),
  motherTongue: z.string().optional(),
  penNumber: z.string().optional(),
  satsNumber: z.string().optional(),
  apaarId: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  guardianName: z.string().optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  occupation: z.string().optional(),
  annualIncome: z.string().optional(),
  permanentAddress: z.string().optional(),
})

interface Props {
  studentId?: string
  defaultValues?: Partial<StudentFormData>
  /** PDF file passed in from parent (e.g. OCR review page) */
  admissionPdfFile?: File | null
}

export default function StudentForm({ studentId, defaultValues, admissionPdfFile }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null)
  const [skipDup, setSkipDup] = useState(false)
  const [sameAsPresentAddress, setSameAsPresentAddress] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(admissionPdfFile ?? null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<StudentFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      gender: 'MALE',
      bloodGroup: 'UNKNOWN',
      academicYear: ACADEMIC_YEARS[ACADEMIC_YEARS.length - 1],
      admissionDate: new Date().toISOString().split('T')[0],
    },
  })

  function handleSameAddressToggle(checked: boolean) {
    setSameAsPresentAddress(checked)
    if (checked) {
      const present = [
        watch('address'), watch('city'), watch('district'), watch('state'), watch('pincode'),
      ].filter(Boolean).join(', ')
      setValue('permanentAddress', present)
    }
  }

  async function saveStudent(data: StudentFormData) {
    setLoading(true)
    setError('')
    try {
      const url = studentId ? `/api/students/${studentId}` : '/api/students'
      const method = studentId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')

      // If a PDF was attached, upload it now that we have the student ID
      if (pdfFile) {
        try {
          const fd = new FormData()
          fd.append('file', pdfFile)
          await fetch(`/api/students/${json.id}/admission-pdf`, { method: 'POST', body: fd })
        } catch {
          // Non-fatal — student is saved, PDF upload failure shouldn't block navigation
        }
      }

      router.push(`/dashboard/students/${json.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(data: StudentFormData) {
    // Duplicate check on new records only
    if (!studentId && !skipDup) {
      try {
        const res = await fetch('/api/students/duplicate-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: data.studentName,
            dateOfBirth: data.dateOfBirth,
            fatherName: data.fatherName,
            phone: data.phone,
          }),
        })
        const json = await res.json()
        if (json.duplicate) {
          setDuplicate(json.duplicate)
          return
        }
      } catch {
        // If duplicate check fails, proceed
      }
    }
    await saveStudent(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {duplicate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Possible duplicate detected</p>
            <p className="text-sm text-amber-700 mt-1">
              A student named <strong>{duplicate.name}</strong> already exists with similar details.{' '}
              <a href={`/student/${duplicate.id}`} target="_blank" className="underline font-medium">
                View existing record →
              </a>
            </p>
            <div className="flex gap-2 mt-3">
              <button type="button"
                onClick={() => { setSkipDup(true); setDuplicate(null); handleSubmit(saveStudent)() }}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                Save anyway (not a duplicate)
              </button>
              <button type="button"
                onClick={() => setDuplicate(null)}
                className="text-xs border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admission Details */}
      <Section title="Admission Details">
        <Grid>
          <Field label="Admission Number *" error={errors.admissionNumber?.message}>
            <input {...register('admissionNumber')} placeholder="ADM-2024-0001" className="form-input" />
          </Field>
          <Field label="Admission Date *" error={errors.admissionDate?.message}>
            <input {...register('admissionDate')} type="date" className="form-input" />
          </Field>
          <Field label="Academic Year *" error={errors.academicYear?.message}>
            <select {...register('academicYear')} className="form-input">
              {[...ACADEMIC_YEARS].reverse().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Class *" error={errors.className?.message}>
            <select {...register('className')} className="form-input">
              <option value="">Select class</option>
              {CLASSES.map(c => (
                <option key={c} value={c}>
                  {c === 'Nursery' || c === 'LKG' || c === 'UKG' ? c : `Class ${c}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Section">
            <input {...register('section')} placeholder="A / B / C" className="form-input" />
          </Field>
        </Grid>
      </Section>

      {/* Student Details */}
      <Section title="Student Details">
        <Grid>
          <Field label="Student Name *" error={errors.studentName?.message} wide>
            <input {...register('studentName')} placeholder="Full name" className="form-input" />
          </Field>
          <Field label="Gender *" error={errors.gender?.message}>
            <select {...register('gender')} className="form-input">
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Date of Birth *" error={errors.dateOfBirth?.message}>
            <input {...register('dateOfBirth')} type="date" className="form-input" />
          </Field>
          <Field label="Place of Birth">
            <input {...register('placeOfBirth')} placeholder="City, State" className="form-input" />
          </Field>
          <Field label="Blood Group">
            <select {...register('bloodGroup')} className="form-input">
              {BLOOD_GROUPS.map(bg => (
                <option key={bg} value={bg}>{BLOOD_GROUP_LABELS[bg]}</option>
              ))}
            </select>
          </Field>
          <Field label="Aadhar Number">
            <input {...register('aadharNumber')} placeholder="12-digit Aadhar" maxLength={12} className="form-input" />
          </Field>
          <Field label="Mother Tongue">
            <input {...register('motherTongue')} placeholder="e.g. Kannada, Hindi" className="form-input" />
          </Field>
          <Field label="Siblings">
            <input {...register('siblings')} placeholder="Names / count of siblings" className="form-input" />
          </Field>
          <Field label="Religion">
            <input {...register('religion')} placeholder="Religion" className="form-input" />
          </Field>
          <Field label="Caste / Category">
            <input {...register('caste')} placeholder="General / OBC / SC / ST" className="form-input" />
          </Field>
          <Field label="Previous School">
            <input {...register('previousSchool')} placeholder="Previous school name" className="form-input" />
          </Field>
          <Field label="TC Number">
            <input {...register('tcNumber')} placeholder="Transfer certificate number" className="form-input" />
          </Field>
          <Field label="PEN No.">
            <input {...register('penNumber')} placeholder="Permanent Education Number" className="form-input" />
          </Field>
          <Field label="SATS No.">
            <input {...register('satsNumber')} placeholder="SATS number" className="form-input" />
          </Field>
          <Field label="Apaar ID No.">
            <input {...register('apaarId')} placeholder="APAAR ID" className="form-input" />
          </Field>
          <Field label="Remarks" wide>
            <textarea {...register('remarks')} rows={2} placeholder="Any additional remarks"
              className="form-input resize-none" />
          </Field>
        </Grid>
      </Section>

      {/* Parent Details */}
      <Section title="Parent / Guardian Details">
        <Grid>
          <Field label="Father's Name">
            <input {...register('fatherName')} placeholder="Father's full name" className="form-input" />
          </Field>
          <Field label="Mother's Name">
            <input {...register('motherName')} placeholder="Mother's full name" className="form-input" />
          </Field>
          <Field label="Guardian Name">
            <input {...register('guardianName')} placeholder="If different from parents" className="form-input" />
          </Field>
          <Field label="Primary Phone">
            <input {...register('phone')} placeholder="10-digit mobile number" maxLength={10} className="form-input" />
          </Field>
          <Field label="Alternate Phone">
            <input {...register('alternatePhone')} placeholder="Alternate number" maxLength={10} className="form-input" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input {...register('email')} type="email" placeholder="parent@email.com" className="form-input" />
          </Field>
          <Field label="Occupation">
            <input {...register('occupation')} placeholder="Occupation" className="form-input" />
          </Field>
          <Field label="Annual Income">
            <input {...register('annualIncome')} placeholder="e.g. ₹3,00,000" className="form-input" />
          </Field>
        </Grid>
      </Section>

      {/* Address */}
      <Section title="Address">
        <Grid>
          <Field label="Present Postal Address" wide>
            <input {...register('address')} placeholder="House/Flat, Street, Colony" className="form-input" />
          </Field>
          <Field label="City">
            <input {...register('city')} placeholder="City" className="form-input" />
          </Field>
          <Field label="District">
            <input {...register('district')} placeholder="District" className="form-input" />
          </Field>
          <Field label="State">
            <input {...register('state')} placeholder="State" className="form-input" />
          </Field>
          <Field label="Pincode">
            <input {...register('pincode')} placeholder="6-digit PIN" maxLength={6} className="form-input" />
          </Field>
        </Grid>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sameAsPresentAddress}
              onChange={e => handleSameAddressToggle(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Permanent address same as present address</span>
          </label>
          <Field label="Permanent Postal Address" wide>
            <textarea
              {...register('permanentAddress')}
              rows={2}
              disabled={sameAsPresentAddress}
              placeholder="Full permanent address, if different from above"
              className="form-input resize-none disabled:bg-gray-50 disabled:text-gray-400"
            />
          </Field>
        </div>
      </Section>

      {/* Admission Form PDF */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="form-section-title">Original Admission Form (PDF)</h3>
        <p className="text-xs text-gray-400 mb-4">
          Optional — attach a scan of the physical admission form for reference.
          The file will be automatically compressed and stored securely.
        </p>
        <AdmissionPdfUpload
          studentId={studentId}
          onFileSelected={setPdfFile}
        />
        {pdfFile && !studentId && (
          <p className="text-xs text-blue-600 mt-2">
            PDF will be uploaded automatically when you click "Save Admission" below.
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2 pb-8">
        <button type="submit" disabled={loading}
          className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {studentId ? 'Update Student' : 'Save Admission'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="form-section-title">{title}</h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {children}
    </div>
  )
}

function Field({ label, error, children, wide }: {
  label: string
  error?: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
