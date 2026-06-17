import Link from 'next/link'
import { GraduationCap, AlertCircle } from 'lucide-react'

export default function StudentNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
        <GraduationCap className="w-8 h-8 text-blue-700" />
      </div>
      <div className="flex items-center gap-2 text-amber-600 mb-3">
        <AlertCircle className="w-5 h-5" />
        <span className="font-medium">Record not found</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Profile Not Found</h1>
      <p className="text-gray-500 text-sm max-w-md mb-6">
        This student record doesn't exist, may have been removed, or the URL is incorrect.
        Please verify the admission number and try again.
      </p>
      <p className="text-xs text-gray-400 mb-6">
        Guru Shree Vidya Kendra — Digital Record Management System
      </p>
    </div>
  )
}
