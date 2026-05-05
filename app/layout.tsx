import type { Metadata, Viewport } from 'next'
import { FirmProvider } from '@/lib/firm/context'
import { BrandingProvider } from '@/lib/branding/context'
import { I18nProvider } from '@/lib/i18n/context'
import { PinLockProvider } from '@/lib/lock/context'
import { InviteAutoLinker } from '@/components/auth/InviteAutoLinker'
import { APP_NAME, APP_DESCRIPTION, APP_SLOGAN, APP_VERSION, APP_COMMIT_ID } from '@/lib/utils/index'
import { ThemeProvider } from '@/lib/theme/context'
import { UpdateNotification } from '@/components/ui'
import { CookieConsent } from '@/components/ui/CookieConsent'
import './globals.css'
export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} | ${APP_SLOGAN}`,
    template: `%s | ${APP_NAME}`
  },
  description: APP_DESCRIPTION,
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png'
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

import { Providers } from '@/components/Providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0038b8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Hind+Madurai:wght@300;400;500;600;700&family=Audiowide&display=swap" rel="stylesheet" />
        {/* Blocking script to prevent theme flickering */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'light';
                var supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var active = theme === 'system' ? (supportDark ? 'dark' : 'light') : (theme === 'mono' ? 'light' : theme);
                
                document.documentElement.classList.add(active);
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.setAttribute('data-active-theme', active);
              } catch (e) {}
            })();
          `
        }} />
        {/* Local Fonts are now loaded via fonts.css */}
        {/* ── Version Sync & Self-Healing (Earliest Activation) ── */}
        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            var storageKey = 'chitvault_chunk_reload_count';
            function handleSync(errorMessage) {
              var isVersionMismatch = errorMessage && (
                errorMessage.indexOf('ChunkLoadError') !== -1 || 
                errorMessage.indexOf('Loading chunk') !== -1 ||
                errorMessage.indexOf('Failed to fetch') !== -1 ||
                errorMessage.indexOf("Unexpected token '<'") !== -1 ||
                errorMessage.indexOf("Unexpected token '{'") !== -1
              );
              
              if (isVersionMismatch) {
                var now = Date.now();
                var data = JSON.parse(sessionStorage.getItem(storageKey) || '{"count":0, "last":0}');
                
                if (now - data.last > 60000) data.count = 0;
                
                if (data.count < 3) {
                  data.count++;
                  data.last = now;
                  sessionStorage.setItem(storageKey, JSON.stringify(data));
                  
                  console.info('System Sync: New version detected, updating session components...');
                  // Dispatch to show the "Update Available" banner
                  window.dispatchEvent(new CustomEvent('app-update-available'));
                }
              }
            }
            window.addEventListener('error', function(e) { handleSync(e.message); }, true);
            window.addEventListener('unhandledrejection', function(e) { 
              var msg = (e.reason && e.reason.message) || String(e.reason);
              handleSync(msg); 
            });

            // Register PWA Service Worker with cache invalidation
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                var appVersion = '${APP_COMMIT_ID !== 'N/A' ? APP_COMMIT_ID : APP_VERSION}';
                var swPath = '/sw.js?v=' + appVersion;

                navigator.serviceWorker.register(swPath).then(function(reg) {
                  // 1. Detect updates from standard SW lifecycle
                  reg.addEventListener('updatefound', function() {
                    var newWorker = reg.installing;
                    if (newWorker) {
                      newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          window.dispatchEvent(new CustomEvent('app-update-available'));
                        }
                      });
                    }
                  });

                  // 2. FORCE PROBE: Check for update on every page load (Bypass Hostinger cache)
                  // We fetch sw.js with a timestamp to see if the server has a newer one
                  if (navigator.onLine) {
                    reg.update().catch(function(e) { console.debug('Probe failed', e); });
                  }
                }).catch(function(err) {
                  console.warn('SW registration failed: ', err);
                });
              });
            }
          })();
        `}} />
      </head>
      <body>
        <Providers>
          <ThemeProvider>
            <FirmProvider>
              <BrandingProvider>
                <I18nProvider>
                  <PinLockProvider>
                    {children}
                    <InviteAutoLinker />
                    <UpdateNotification />
                    <CookieConsent />
                  </PinLockProvider>
                </I18nProvider>
              </BrandingProvider>
            </FirmProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
