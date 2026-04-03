import type { Metadata } from 'next'
import './globals.css' // THIS IS CRUCIAL FOR TAILWIND TO WORK

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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        {/* The 'children' here will be your page.tsx files (Login, Admin, Client) */}
       {children}
      </body>
    </html>
  )
}
