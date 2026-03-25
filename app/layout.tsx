import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import { FirmProvider } from '@/lib/firm/context'
import { BrandingProvider } from '@/lib/branding/BrandingProvider'
import './globals.css'

const dmSans   = DM_Sans({ subsets: ['latin'], weight: ['300','400','500','600'], variable: '--font-dm-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['600','700'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'ChitVault',
  description: 'Chit Fund Management Software',
  icons: { icon: '/icons/icon-32.png', apple: '/icons/icon-152.png' },
}

export const viewport: Viewport = {
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        {/* Google Fonts preconnect for fast dynamic font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${dmSans.variable} ${playfair.variable}`}>
        <FirmProvider>
          <BrandingProvider>
            {children}
          </BrandingProvider>
        </FirmProvider>
      </body>
    </html>
  )
}
