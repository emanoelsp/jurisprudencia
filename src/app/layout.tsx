// src/app/layout.tsx
import type { Metadata } from 'next'
import { Playfair_Display, Source_Sans_3, JetBrains_Mono } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source',
  display: 'swap',
  weight: ['300', '400', '600', '700'],
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'IURISPRUDENTIA — Inteligência Jurídica',
  description: 'Dados. Direito. Decisão.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${sourceSans.variable} ${jetbrains.variable}`}>
      <body className="bg-brand-navy text-brand-cream font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#132040',
                color: '#F8F5EF',
                border: '1px solid #1E2D4A',
                fontFamily: 'var(--font-source)',
              },
              success: { iconTheme: { primary: '#C9A94E', secondary: '#0B1628' } },
              error:   { iconTheme: { primary: '#EF4444', secondary: '#0B1628' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
