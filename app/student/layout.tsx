import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Student Profile — Guru Shree Vidya Kendra',
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
