'use client'

import { useState, useEffect } from 'react'
import { Settings, Database, Shield, Download, CheckCircle, Loader2, Users } from 'lucide-react'
import { formatDate, formatFileSize } from '@/lib/utils'

interface Backup {
  id: string
  backupType: string
  storagePath: string
  fileSize: number | null
  status: string
  createdAt: string
}

export default function SettingsPage() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [backingUp, setBackingUp] = useState(false)
  const [backupDone, setBackupDone] = useState(false)

  useEffect(() => {
    fetch('/api/backup').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setBackups(d)
    })
  }, [backupDone])

  async function runBackup() {
    setBackingUp(true)
    setBackupDone(false)
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'MANUAL' }),
      })
      if (res.ok) setBackupDone(true)
    } catch (e) {
      alert('Backup failed: ' + e)
    } finally {
      setBackingUp(false)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">System configuration and maintenance</p>
      </div>

      {/* System info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-gray-400" /> System Information
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <Row label="System" value="GSVK Digital Records v1.0.0" />
            <Row label="School" value="Guru Shree Vidya Kendra" />
            <Row label="Records Coverage" value="1999 – 2026" />
          </div>
          <div className="space-y-3">
            <Row label="Database" value="PostgreSQL + Prisma ORM" />
            <Row label="Storage" value="Supabase Storage" />
            <Row label="OCR Engine" value="Google Vision API" />
          </div>
        </div>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-gray-400" /> Database Backup
        </h2>
        <p className="text-sm text-gray-500 mb-4">Create a full JSON backup of all student records and documents</p>

        {backupDone && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" /> Backup completed successfully
          </div>
        )}

        <button
          onClick={runBackup}
          disabled={backingUp}
          className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          {backingUp ? <><Loader2 className="w-4 h-4 animate-spin" />Creating backup...</> : <><Download className="w-4 h-4" />Run Manual Backup</>}
        </button>

        {backups.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Backups</h3>
            <div className="space-y-2">
              {backups.slice(0, 10).map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${b.status === 'COMPLETED' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{b.backupType} Backup</p>
                      <p className="text-xs text-gray-400">{formatDate(b.createdAt)} · {b.fileSize ? formatFileSize(b.fileSize) : '—'}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    b.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}>{b.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Access control */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-gray-400" /> Access Control
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Users className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-800">Super Admin</p>
              <p className="text-blue-600 text-xs mt-0.5">Full access: create, read, update, delete students, manage users, run backups</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Users className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-700">Data Entry Operator</p>
              <p className="text-gray-500 text-xs mt-0.5">Create and update students, upload documents, run OCR. Cannot delete records.</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">User accounts are managed through Supabase Auth dashboard.</p>
        </div>
      </div>

      {/* Environment */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Environment Variables Required</h2>
        <div className="space-y-1.5 font-mono text-xs">
          {[
            'DATABASE_URL',
            'NEXT_PUBLIC_SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'SUPABASE_SERVICE_ROLE_KEY',
            'SUPABASE_STORAGE_BUCKET',
            'GOOGLE_VISION_API_KEY',
            'NEXT_PUBLIC_APP_URL',
          ].map(v => (
            <div key={v} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="text-gray-700">{v}</span>
              {process.env[v] || process.env[`NEXT_PUBLIC_${v}`] ? (
                <span className="text-green-500 ml-auto">✓ set</span>
              ) : (
                <span className="text-amber-500 ml-auto">⚠ not set</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-gray-800">{value}</p>
    </div>
  )
}
