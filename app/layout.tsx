import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try {
            var savedTheme = window.localStorage.getItem('dashboard-theme');
            var shouldUseDark = savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', shouldUseDark);
            document.body.classList.toggle('dark', shouldUseDark);
          } catch (error) {}
          `}
        </Script>
        {/* The 'children' here will be your page.tsx files (Login, Admin, Client) */}
        {children}
      </body>
    </html>
  )
}
