import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GSVK Digital Records | Guru Shree Vidya Kendra',
  description: 'Digital Admission Record Management System for Guru Shree Vidya Kendra',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
