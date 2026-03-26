'use client'

import { useEffect } from 'react'
import { useFirm } from '@/lib/firm/context'
import { applyBranding } from '@/lib/branding/context'

// Branding context provider that applies firm-specific styles to the DOM
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { firm } = useFirm()

  useEffect(() => {
    if (firm) {
      // 1. Apply CSS Variables (Colors & Fonts)
      applyBranding(
        firm.primary_color || '#2563eb', 
        firm.font || 'DM Sans', 
        firm.accent_color || '#1e40af'
      )

      // 2. Update Page Title
      if (firm.name) {
        document.title = firm.name
      }

      // 3. Update Favicon dynamically
      const iconUrl = firm.logo_url || '/icons/icon-32.png'
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = iconUrl

      // 4. Update Theme Color (Meta tag for mobile browsing)
      let metaTheme: HTMLMetaElement | null = document.querySelector("meta[name='theme-color']")
      if (metaTheme) {
        metaTheme.setAttribute('content', firm.primary_color || '#2563eb')
      }
    }
  }, [firm])

  return <>{children}</>
}
