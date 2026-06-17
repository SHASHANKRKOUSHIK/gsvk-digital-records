'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function QrRegenerateButton({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function regenerate() {
    setLoading(true)
    try {
      await fetch(`/api/students/${studentId}/qr`, { method: 'POST' })
      router.refresh()
    } catch (e) {
      alert('Failed to regenerate: ' + e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={regenerate}
      disabled={loading}
      className="flex-1 inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      Regenerate
    </button>
  )
}
