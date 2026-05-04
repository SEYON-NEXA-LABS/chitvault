'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import type { Firm } from '@/types'
import { useFirm } from '@/lib/firm/context'
import { APP_NAME } from '@/lib/utils'

interface BrandingContext {
  name: string
  font: string
  colorProfile: string
  setTheme: (id: string) => void
}

const Ctx = createContext<BrandingContext>({
  name: 'ChitVault Manager',
  font: 'Inter', colorProfile: 'indigo',
  setTheme: () => {}
})

export function BrandingProvider({ children }: {
  children: React.ReactNode
}) {
  const { firm } = useFirm()
  const name = firm?.name || APP_NAME
  const font = firm?.font || 'Inter'
  
  const [colorProfile, setColorProfile] = useState<string>('indigo')
  const [isBrandingReady, setIsBrandingReady] = useState(false)

  useEffect(() => {
    // Enforcement: Only Firm Default is used (Managed White-Labeling)
    const firmDefault = firm?.color_profile || 'indigo'
    setColorProfile(firmDefault)
    setIsBrandingReady(true)
  }, [firm?.color_profile])

  const setTheme = (id: string) => {
    // This now only exists for potential future superadmin usage or local testing
    // Regular users no longer have a UI to trigger this for Profiles
    console.warn('Manual Profile override is disabled for managed white-labeling.')
  }

  useEffect(() => {
    applyBranding(font, colorProfile)

    // Sync Page Title
    if (firm?.name) {
      document.title = firm.name
    }

    // Fixed Favicon (No storage space for custom logos)
    const iconUrl = '/icons/icon-192.png'
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = iconUrl

  }, [firm?.name, font, colorProfile])

  return (
    <Ctx.Provider value={{ name, font, colorProfile, setTheme }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBranding() { return useContext(Ctx) }

export const AVAILABLE_FONTS = [
  { label: 'AudioWide (Brand Header)', value: 'Audiowide' },
  { label: 'Outfit (English Standard)', value: 'Outfit' },
  { label: 'Hind Madurai (Tamil Standard)', value: 'Hind Madurai' },
]

export const COLOR_PROFILES = [
  { id: 'indigo',       name: 'Trust Blue',       color: '#0038b8' },
  { id: 'emerald',      name: 'Emerald Growth',   color: '#10b981' },
  { id: 'slate',        name: 'Onyx Slate',       color: '#475569' },
  { id: 'rose',         name: 'Rose Alert',       color: '#e11d48' },
]

// For backward compatibility with picker UI
export const PRESET_COLORS = COLOR_PROFILES.map(p => ({ label: p.name, value: p.color, id: p.id }))

// Apply CSS variables + Load local font definitions
export function applyBranding(font: string, colorProfile: string = 'indigo') {
  const root = document.documentElement

  // Set Profile Attribute (Source of truth for CSS variables in globals.css)
  root.setAttribute('data-color-profile', colorProfile)

  // Apply font stack
  const fontStack = `'${font}', sans-serif`
  
  root.style.setProperty('--font-body', fontStack)
  document.body.style.fontFamily = fontStack
}
