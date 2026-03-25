import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css' // THIS IS CRUCIAL FOR TAILWIND TO WORK

// Load a clean, modern font
const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Accident Monitoring Dashboard',
  description: 'Admin and Client dashboard for accident tracking',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900`}>
        {/* The 'children' here will be your page.tsx files (Login, Admin, Client) */}
        {children}
      </body>
    </html>
  )
}