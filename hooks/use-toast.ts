'use client'

// Re-export from the toaster component for convenience
export { toast } from '@/components/ui/toaster'

export function useToast() {
  return { toast: (require('@/components/ui/toaster') as { toast: typeof import('@/components/ui/toaster').toast }).toast }
}
