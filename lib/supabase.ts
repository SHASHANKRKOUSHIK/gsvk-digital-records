import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function uploadFile(
  file: File | Buffer,
  path: string,
  contentType?: string
): Promise<string> {
  const supabase = createSupabaseAdminClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'gsvk-documents'

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteFile(path: string): Promise<void> {
  const supabase = createSupabaseAdminClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'gsvk-documents'
  await supabase.storage.from(bucket).remove([path])
}
