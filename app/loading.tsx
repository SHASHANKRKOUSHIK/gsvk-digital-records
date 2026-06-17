import { GraduationCap } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <GraduationCap className="w-8 h-8 text-blue-700" />
        </div>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  )
}
