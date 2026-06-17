import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import type { User } from '@prisma/client'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server component — ignore
          }
        },
      },
    }
  )
}

export async function getServerUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return null
    return await prisma.user.findUnique({ where: { email: user.email } })
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireSuperAdmin(): Promise<User> {
  const user = await requireAuth()
  if (user.role !== 'SUPER_ADMIN') throw new Error('Forbidden')
  return user
}
