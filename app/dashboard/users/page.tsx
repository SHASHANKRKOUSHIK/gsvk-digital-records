import { prisma } from '@/lib/prisma'
import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { Users, Shield, UserCheck, Mail } from 'lucide-react'
import AddUserModal from '@/components/forms/AddUserModal'

export default async function UsersPage() {
  const currentUser = await getServerUser()
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} system users</p>
        </div>
        <AddUserModal />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Note:</strong> Users must also be created in Supabase Auth dashboard with the same email address. The role and access level are controlled here.
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                {u.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800">{u.name}</p>
                  {u.id === currentUser.id && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">You</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Mail className="w-3 h-3" />{u.email}
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">Since {formatDateTime(u.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  u.role === 'SUPER_ADMIN'
                    ? 'bg-violet-50 text-violet-700'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {u.role === 'SUPER_ADMIN'
                    ? <><Shield className="w-3 h-3" />Super Admin</>
                    : <><UserCheck className="w-3 h-3" />Operator</>
                  }
                </span>
                <span className={`w-2 h-2 rounded-full ${u.active ? 'bg-green-400' : 'bg-gray-300'}`}
                  title={u.active ? 'Active' : 'Inactive'} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-gray-400" />Role Permissions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Permission</th>
                <th className="pb-2 text-xs font-semibold text-violet-600 uppercase tracking-wide text-center">Super Admin</th>
                <th className="pb-2 text-xs font-semibold text-blue-600 uppercase tracking-wide text-center">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ['View students', true, true],
                ['Create students', true, true],
                ['Edit students', true, true],
                ['Delete students', true, false],
                ['Upload documents', true, true],
                ['Run OCR', true, true],
                ['Export Excel', true, true],
                ['Manage users', true, false],
                ['Run backups', true, false],
                ['View audit logs', true, true],
              ].map(([perm, sa, op]) => (
                <tr key={String(perm)}>
                  <td className="py-2 text-gray-700">{perm}</td>
                  <td className="py-2 text-center">{sa ? '✅' : '❌'}</td>
                  <td className="py-2 text-center">{op ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
