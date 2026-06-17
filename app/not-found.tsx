import Link from 'next/link'
import { GraduationCap } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
        <GraduationCap className="w-8 h-8 text-blue-700" />
      </div>
      <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
      <p className="text-lg font-medium text-gray-700 mb-1">Page not found</p>
      <p className="text-gray-400 text-sm mb-6">The student record or page you're looking for doesn't exist or has been removed.</p>
      <div className="flex gap-3">
        <Link href="/dashboard" className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
          Go to Dashboard
        </Link>
        <Link href="/dashboard/search" className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
          Search Students
        </Link>
      </div>
    </div>
  )
}
