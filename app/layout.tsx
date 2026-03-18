import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import { FirmProvider } from '@/lib/firm/context'
import './globals.css'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['600','700'], variable: '--font-playfair' })
const dmSans   = DM_Sans({ subsets: ['latin'], weight: ['300','400','500','600'], variable: '--font-dm-sans' })

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'ChitVault'

export const metadata: Metadata = {
  title:       `${appName} — Chit Fund Manager`,
  description: 'Auction Chit Fund Management SaaS',
  manifest:    '/manifest.json',
  themeColor:  '#c9a84c',
  icons: { icon: '/icons/icon-32.png', apple: '/icons/icon-152.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${playfair.variable} ${dmSans.variable} font-sans`}>
        <FirmProvider>
          {children}
        </FirmProvider>
      </body>
    </html>
  )
}
