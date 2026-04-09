'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import type { Firm } from '@/types'
import { useFirm } from '@/lib/firm/context'
import { APP_NAME } from '@/lib/utils'

interface BrandingContext {
  name: string
  font: string
  colorProfile: string
}

const Ctx = createContext<BrandingContext>({
  name: 'Seyon Chit Vault',
  font: 'Inter', colorProfile: 'indigo'
})

export function BrandingProvider({ children }: {
  children: React.ReactNode
}) {
  const { firm } = useFirm()
  const name = firm?.name || APP_NAME
  const font = firm?.font || 'Inter'
  
  const [colorProfile, setColorProfile] = useState<string>(firm?.color_profile || 'indigo')

  useEffect(() => {
    // Only run on client after mount to prevent hydration mismatch
    const saved = localStorage.getItem('chitvault-user-color-profile')
    if (saved) setColorProfile(saved)
  }, [])

  useEffect(() => {
    applyBranding(font, colorProfile)

    // Sync Page Title
    if (firm?.name) {
      document.title = firm.name
    }

    // Update Favicon dynamically
    const iconUrl = firm?.logo_url || '/icons/icon-192.png'
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = iconUrl

  }, [firm?.name, firm?.logo_url, font, colorProfile])

  return (
    <Ctx.Provider value={{ name, font, colorProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBranding() { return useContext(Ctx) }

export const AVAILABLE_FONTS = [
  { label: 'Inter (Modern Standard)', value: 'Inter' },
  { label: 'Outfit (Geometric Premium)', value: 'Outfit' },
  { label: 'Noto Sans (Best Support)', value: 'Noto Sans' },
]

export const COLOR_PROFILES = [
  { id: 'indigo',       name: 'ChitVault Premium', color: '#2563eb' },
]

// For backward compatibility with picker UI
export const PRESET_COLORS = COLOR_PROFILES.map(p => ({ label: p.name, value: p.color, id: p.id }))

// Apply CSS variables + load Google Font dynamically
export function applyBranding(font: string, colorProfile: string = 'indigo') {
  const root = document.documentElement

  // Set Profile Attribute (Source of truth for CSS variables in globals.css)
  root.setAttribute('data-color-profile', colorProfile)

  // Load Google Font if not already loaded
  const fontId = `gfont-${font.replace(/\s+/g, '-').toLowerCase()}`
  if (!document.getElementById(fontId)) {
    const link = document.createElement('link')
    link.id = fontId
    link.rel = 'stylesheet'

    let fontPath = font.replace(/ /g, '+')
    if (font === 'Noto Sans') fontPath += '&family=Noto+Sans+Tamil'
    if (font === 'Mukta Malar') fontPath = 'Mukta+Malar'
    if (font === 'Hind Madurai') fontPath = 'Hind+Madurai'

    link.href = `https://fonts.googleapis.com/css2?family=${fontPath}:wght@300;400;500;600;700&display=swap`
    document.head.appendChild(link)
  }

  // Apply font
  const fontStack = font === 'Noto Sans' ? `'Noto Sans', 'Noto Sans Tamil', sans-serif` : `'${font}', sans-serif`
  root.style.setProperty('--font-body', fontStack)
  document.body.style.fontFamily = fontStack
}
