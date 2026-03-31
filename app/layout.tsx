import type { Metadata, Viewport } from 'next'
import { Noto_Sans, Noto_Sans_Tamil } from 'next/font/google'
import { FirmProvider } from '@/lib/firm/context'
import { BrandingProvider } from '@/lib/branding/context'
import { I18nProvider } from '@/lib/i18n/context'
import { PinLockProvider } from '@/lib/lock/context'
import { PwaProvider } from '@/lib/pwa/context'
import { InviteAutoLinker } from '@/components/auth/InviteAutoLinker'
import './globals.css'

const noto = Noto_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-noto' })
const notoTamil = Noto_Sans_Tamil({ subsets: ['tamil'], weight: ['400', '500', '600', '700'], variable: '--font-noto-tamil' })

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'SEYON ChitVault',
  description: 'Chit Fund Management Software',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-512.png' },
  manifest: '/manifest.webmanifest'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#2563eb" />
        {/* Blocking script to prevent theme flickering */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'light';
                var supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var active = theme === 'system' ? (supportDark ? 'dark' : 'light') : theme;
                
                document.documentElement.classList.add(active);
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.setAttribute('data-active-theme', active);
              } catch (e) {}
            })();
          `
        }} />
        {/* Google Fonts preconnect for fast dynamic font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${noto.variable} ${notoTamil.variable}`}>
        <FirmProvider>
          <BrandingProvider>
            <I18nProvider>
              <PinLockProvider>
                <PwaProvider>
                  {children}
                  <InviteAutoLinker />
                </PwaProvider>
              </PinLockProvider>
            </I18nProvider>
          </BrandingProvider>
        </FirmProvider>
        <script dangerouslySetInnerHTML={{
          __html: `
          window.deferredPrompt = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.deferredPrompt = e;
          });

          if ('serviceWorker' in navigator) {
            if (${process.env.NODE_ENV === 'production' ? 'true' : 'false'}) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            } else {
              // Always unregister in dev to stop service worker interference on localhost
              navigator.serviceWorker.getRegistrations().then(regs => {
                for(let reg of regs) reg.unregister();
              });
            }
          }
        `}} />
      </body>
    </html>
  )
}
