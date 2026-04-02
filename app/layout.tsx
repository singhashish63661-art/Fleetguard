import type { Metadata } from 'next'
import Script from 'next/script'
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
