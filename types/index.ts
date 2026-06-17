export type Role = 'SUPER_ADMIN' | 'DATA_ENTRY_OPERATOR'
export type Gender = 'MALE' | 'FEMALE' | 'OTHER'
export type BloodGroup = 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG' | 'UNKNOWN'
export type OcrStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVIEW'
export type DocumentType = 'ADMISSION_FORM' | 'BIRTH_CERTIFICATE' | 'TRANSFER_CERTIFICATE' | 'MARK_SHEET' | 'PHOTO' | 'AADHAR' | 'OTHER'

export interface Student {
  id: string
  admissionNumber: string
  admissionDate: string
  studentName: string
  gender: Gender
  dateOfBirth: string
  bloodGroup: BloodGroup
  aadharNumber?: string | null
  className: string
  section?: string | null
  academicYear: string
  religion?: string | null
  caste?: string | null
  previousSchool?: string | null
  tcNumber?: string | null
  remarks?: string | null
  photoUrl?: string | null
  qrCode?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  parents?: Parent[]
  documents?: Document[]
  auditLogs?: AuditLog[]
}

export interface Parent {
  id: string
  studentId: string
  fatherName?: string | null
  motherName?: string | null
  guardianName?: string | null
  phone?: string | null
  alternatePhone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  pincode?: string | null
  occupation?: string | null
}

export interface Document {
  id: string
  studentId: string
  documentType: DocumentType
  originalName: string
  storagePath: string
  processedPath?: string | null
  ocrText?: string | null
  fileSize?: number | null
  mimeType?: string | null
  uploadedAt: string
}

export interface OcrJob {
  id: string
  documentId?: string | null
  studentId?: string | null
  userId: string
  status: OcrStatus
  fileName: string
  storagePath: string
  rawText?: string | null
  extractedData?: Partial<StudentFormData> | null
  errorMessage?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  userId: string
  studentId?: string | null
  action: string
  entity: string
  entityId: string
  oldData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
  createdAt: string
  user?: { name: string; email: string }
}

export interface StudentFormData {
  admissionNumber: string
  admissionDate: string
  studentName: string
  gender: Gender
  dateOfBirth: string
  bloodGroup: BloodGroup
  aadharNumber?: string
  className: string
  section?: string
  academicYear: string
  religion?: string
  caste?: string
  previousSchool?: string
  tcNumber?: string
  remarks?: string
  fatherName?: string
  motherName?: string
  guardianName?: string
  phone?: string
  alternatePhone?: string
  email?: string
  address?: string
  city?: string
  district?: string
  state?: string
  pincode?: string
  occupation?: string
}

export interface DashboardStats {
  totalStudents: number
  totalAdmissions: number
  currentYearAdmissions: number
  activeOcrJobs: number
  byYear: { year: string; count: number }[]
  byClass: { className: string; count: number }[]
  recentStudents: Student[]
}

export interface SearchFilters {
  query?: string
  className?: string
  academicYear?: string
  gender?: Gender
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const BLOOD_GROUPS: BloodGroup[] = [
  'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN'
]

export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-', UNKNOWN: 'Unknown'
}

export const CLASSES = [
  'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
]

export const ACADEMIC_YEARS: string[] = Array.from({ length: 28 }, (_, i) => {
  const start = 1999 + i
  return `${start}-${String(start + 1).slice(2)}`
})
