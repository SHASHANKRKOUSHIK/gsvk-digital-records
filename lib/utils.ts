import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd MMM yyyy')
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd MMM yyyy, hh:mm a')
  } catch {
    return '—'
  }
}

export function getProfileUrl(studentId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/student/${studentId}`
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function bloodGroupLabel(bg: string): string {
  const map: Record<string, string> = {
    A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
    AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-', UNKNOWN: '?'
  }
  return map[bg] || bg
}

export function classLabel(c: string): string {
  if (c === 'Nursery' || c === 'LKG' || c === 'UKG') return c
  return `Class ${c}`
}

/**
 * Converts a Node Buffer into a plain ArrayBuffer for use as a Response/
 * NextResponse body. Buffer and Uint8Array (even manually wrapped) fail to
 * type-check as BodyInit under recent TypeScript + @types/node versions,
 * because their ArrayBufferLike generic parameter includes
 * SharedArrayBuffer, which BodyInit's stricter ArrayBuffer type rejects.
 * Copying into a fresh ArrayBuffer sidesteps this with no behavioral or
 * performance difference for files of this size.
 */
export function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buf.byteLength)
  new Uint8Array(arrayBuffer).set(buf)
  return arrayBuffer
}
