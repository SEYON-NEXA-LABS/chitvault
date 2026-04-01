'use client'

import { useEffect, createContext, useContext } from 'react'
import type { Firm } from '@/types'
import { useFirm } from '@/lib/firm/context'

interface BrandingContext {
  name: string
  font: string
  colorProfile: string
}

const Ctx = createContext<BrandingContext>({
  name: 'Seyon Chit Vault',
  font: 'Noto Sans', colorProfile: 'indigo'
})

export function BrandingProvider({ children }: {
  children: React.ReactNode
}) {
  const { firm } = useFirm()
  const name = firm?.name || process.env.NEXT_PUBLIC_APP_NAME || 'SEYON ChitVault'
  const font = firm?.font || 'Noto Sans'
  
  // Priority: 1. User Local Preference, 2. Firm Global Setting, 3. Default
  const colorProfile = (typeof window !== 'undefined' && localStorage.getItem('chitvault-user-color-profile')) || firm?.color_profile || 'indigo'

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
  { label: 'Noto Sans (Best Support)', value: 'Noto Sans' },
  { label: 'Mukta Malar', value: 'Mukta Malar' },
  { label: 'Hind Madurai', value: 'Hind Madurai' },
]

export const COLOR_PROFILES = [
  { id: 'indigo',       name: 'Indigo Professional', color: '#3a5ccc' },
  { id: 'emerald',      name: 'Emerald Calm',        color: '#0f766e' },
  { id: 'violet',       name: 'Violet Modern',       color: '#6d28d9' },
  { id: 'crimson',      name: 'Crimson Authority',   color: '#991b1b' },
  { id: 'graphite',     name: 'Neutral Graphite',    color: '#374151' },
  { id: 'slate-blue',   name: 'Slate Blue',          color: '#475569' },
  { id: 'warm-gray',    name: 'Warm Gray',           color: '#52525b' },
  { id: 'muted-teal',   name: 'Muted Teal',          color: '#115e59' },
  { id: 'deep-indigo',  name: 'Deep Indigo',         color: '#312e81' },
  { id: 'bronze',       name: 'Muted Bronze',        color: '#7c4a1d' },
  { id: 'charcoal',     name: 'Charcoal Minimal',    color: '#1f2933' },
  { id: 'steel-blue',   name: 'Steel Blue Ops',      color: '#334155' },
  { id: 'muted-olive',  name: 'Muted Olive',         color: '#3f6212' },
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
