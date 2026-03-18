'use client'

import { useEffect } from 'react'
import { useFirm } from '@/lib/firm/context'

// Function to apply branding properties to the root element
export function applyBranding(primaryColor?: string | null, font?: string | null) {
  const root = document.documentElement
  if (primaryColor) {
    root.style.setProperty('--primary', primaryColor)
  }
  if (font) {
    // Create a new <link> element for the font
    const fontLink = document.createElement('link')
    fontLink.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`
    fontLink.rel = 'stylesheet'
    // Remove any existing dynamic font links to prevent conflicts
    const existingLink = document.querySelector('link[data-dynamic-font]')
    if (existingLink) {
      existingLink.remove()
    }
    fontLink.setAttribute('data-dynamic-font', 'true')
    document.head.appendChild(fontLink)
    // Apply the font-family to the body
    document.body.style.fontFamily = `var(--font-${font.toLowerCase().replace(/ /g, '-')}, ${font}, sans-serif)`
  }
}

// Branding context provider
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { firm } = useFirm()

  useEffect(() => {
    if (firm) {
      applyBranding(firm.primary_color, firm.font)
      if (firm.name) {
        document.title = firm.name
      }
    }
  }, [firm])

  return <>{children}</>
}
