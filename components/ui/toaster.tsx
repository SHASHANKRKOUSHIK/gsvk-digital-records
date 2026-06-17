'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

// Global toast store
const store: { toasts: Toast[]; listeners: Array<(t: Toast[]) => void> } = {
  toasts: [],
  listeners: [],
}

export function toast(options: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  store.toasts = [{ ...options, id }, ...store.toasts].slice(0, 5)
  store.listeners.forEach(fn => fn([...store.toasts]))
  setTimeout(() => {
    store.toasts = store.toasts.filter(t => t.id !== id)
    store.listeners.forEach(fn => fn([...store.toasts]))
  }, 4000)
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    store.listeners.push(setToasts)
    return () => {
      store.listeners = store.listeners.filter(fn => fn !== setToasts)
    }
  }, [])

  function dismiss(id: string) {
    store.toasts = store.toasts.filter(t => t.id !== id)
    store.listeners.forEach(fn => fn([...store.toasts]))
  }

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border shadow-lg p-4 text-sm animate-in slide-in-from-right-full ${
            t.variant === 'destructive'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-white border-gray-200 text-gray-800'
          }`}
        >
          {t.variant === 'destructive'
            ? <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            : <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
          }
          <div className="flex-1 min-w-0">
            {t.title && <p className="font-semibold leading-tight">{t.title}</p>}
            {t.description && <p className="text-xs mt-0.5 opacity-75">{t.description}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
