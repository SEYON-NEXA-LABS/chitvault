'use client'

import { useEffect } from 'react'
import { useFirm } from '@/lib/firm/context'
import { applyBranding, BrandingProvider as BrandingContext } from '@/lib/branding/context'
import { getTheme } from './themes'

// Branding context provider that applies firm-specific styles to the DOM
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { firm } = useFirm()

  useEffect(() => {
    if (firm) {
      const theme = getTheme(firm.theme_id)
      const color = firm.primary_color || theme.primary
      const accent = firm.accent_color || theme.accent
      const bg = theme.bg

      // 1. Apply CSS Variables (Colors & Fonts)
      applyBranding(
        color, 
        firm.font || 'Noto Sans', 
        accent,
        bg
      )

      // 2. Update Page Title
      if (firm.name) {
        document.title = firm.name
      }

      // 3. Update Favicon dynamically
      const iconUrl = firm.logo_url || '/icons/icon-192.png'
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
        metaTheme.setAttribute('content', color)
      }
    }
  }, [firm])

  return (
    <BrandingContext firm={firm}>
      {children}
    </BrandingContext>
  )
}
