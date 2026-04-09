import type { Metadata, Viewport } from 'next'
import { Inter, Outfit, Noto_Sans_Tamil } from 'next/font/google'
import { FirmProvider } from '@/lib/firm/context'
import { BrandingProvider } from '@/lib/branding/context'
import { I18nProvider } from '@/lib/i18n/context'
import { PinLockProvider } from '@/lib/lock/context'
import { InviteAutoLinker } from '@/components/auth/InviteAutoLinker'
import { APP_NAME } from '@/lib/utils/index'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-outfit' })
const notoTamil = Noto_Sans_Tamil({ subsets: ['tamil'], weight: ['400', '500', '600', '700'], variable: '--font-noto-tamil' })

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Chit Fund Management Software',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-512.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
        {/* ── Early-Activation Self-Healing for ChunkLoadErrors ── */}
        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            var storageKey = 'chitvault_chunk_reload_count';
            function handleRecovery(errorMessage) {
              var isChunkError = errorMessage && (
                errorMessage.indexOf('ChunkLoadError') !== -1 || 
                errorMessage.indexOf('Loading chunk') !== -1 ||
                errorMessage.indexOf('Failed to fetch') !== -1 ||
                errorMessage.indexOf("Unexpected token '<'") !== -1 ||
                errorMessage.indexOf("Unexpected token '{'") !== -1
              );
              if (isChunkError) {
                var now = Date.now();
                var reloadData = JSON.parse(sessionStorage.getItem(storageKey) || '{"count":0, "last":0}');
                
                // If it's been more than a minute, reset the counter
                if (now - reloadData.last > 60000) reloadData.count = 0;
                
                if (reloadData.count < 5) {
                  reloadData.count++;
                  reloadData.last = now;
                  sessionStorage.setItem(storageKey, JSON.stringify(reloadData));
                  
                  var forceFullReload = function() {
                    // Try to clear all caches
                    if ('caches' in window) {
                      caches.keys().then(function(names) {
                        names.forEach(function(name) { caches.delete(name); });
                      }).catch(function(){});
                    }
                    // Force unregister service workers
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(function(regs) {
                        regs.forEach(function(reg) { reg.unregister(); });
                        setTimeout(function() { window.location.reload(true); }, 100);
                      }).catch(function() { window.location.reload(true); });
                    } else {
                      window.location.reload(true);
                    }
                  };

                  forceFullReload();
                }
              }
            }
            window.addEventListener('error', function(e) { handleRecovery(e.message); }, true);
            window.addEventListener('unhandledrejection', function(e) { 
              var msg = (e.reason && e.reason.message) || String(e.reason);
              handleRecovery(msg); 
            });
          })();
        `}} />
      </head>
      <body className={`${inter.variable} ${outfit.variable} ${notoTamil.variable}`}>
        <FirmProvider>
          <BrandingProvider>
            <I18nProvider>
              <PinLockProvider>
                {children}
                <InviteAutoLinker />
              </PinLockProvider>
            </I18nProvider>
          </BrandingProvider>
        </FirmProvider>

      </body>
    </html>
  )
}
