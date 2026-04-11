import type { Metadata, Viewport } from 'next'
import { FirmProvider } from '@/lib/firm/context'
import { BrandingProvider } from '@/lib/branding/context'
import { I18nProvider } from '@/lib/i18n/context'
import { PinLockProvider } from '@/lib/lock/context'
import { InviteAutoLinker } from '@/components/auth/InviteAutoLinker'
import { APP_NAME } from '@/lib/utils/index'
import { ThemeProvider } from '@/lib/theme/context'
import { UpdateNotification } from '@/components/ui'
import './globals.css'
import './fonts.css'

// ... (Metadata and Viewport stay the same)

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
        {/* Local Fonts are now loaded via fonts.css */}
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
                  
                  console.warn('ChunkLoadError detected, notifying user for update...', errorMessage);
                  window.dispatchEvent(new CustomEvent('app-update-available'));
                } else {
                  console.error('Max update notification attempts reached.');
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
      <body>
        <ThemeProvider>
          <FirmProvider>
            <BrandingProvider>
              <I18nProvider>
                <PinLockProvider>
                  {children}
                  <InviteAutoLinker />
                  <UpdateNotification />
                </PinLockProvider>
              </I18nProvider>
            </BrandingProvider>
          </FirmProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
