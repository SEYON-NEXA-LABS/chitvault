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
  font: 'Inter', colorProfile: 'eslinks',
  setTheme: () => {}
})

export function BrandingProvider({ children }: {
  children: React.ReactNode
}) {
  const { firm } = useFirm()
  const name = firm?.name || APP_NAME
  const font = firm?.font || 'Inter'
  
  const [colorProfile, setColorProfile] = useState<string>('eslinks')
  const [isBrandingReady, setIsBrandingReady] = useState(false)

  useEffect(() => {
    // Enforcement: Only Firm Default is used (Managed White-Labeling)
    const firmDefault = firm?.color_profile || 'eslinks'
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
  { label: 'Inter (System Standard)', value: 'Inter' },
]

export const COLOR_PROFILES = [
  { id: 'cobalt',   name: 'Classic Cobalt',   color: '#0f62fe' },
  { id: 'violet',   name: 'Royal Violet',     color: '#8a3ffc' },
  { id: 'charcoal', name: 'Nordic Charcoal',   color: '#393939' },
  { id: 'emerald',  name: 'Forest Emerald',   color: '#198038' },
  { id: 'amber',    name: 'Sunset Amber',     color: '#d57300' },
  { id: 'crimson',  name: 'Crimson Rose',     color: '#da1e28' },
]

// For backward compatibility with picker UI
export const PRESET_COLORS = COLOR_PROFILES.map(p => ({ label: p.name, value: p.color, id: p.id }))

// Apply CSS variables + Load local font definitions
export function applyBranding(font: string, colorProfile: string = 'cobalt') {
  const root = document.documentElement

  // Map legacy color profiles to new ones to ensure backward compatibility
  let normalizedProfile = colorProfile
  if (colorProfile === 'eslinks' || colorProfile === 'sky-genesis') {
    normalizedProfile = 'cobalt'
  } else if (colorProfile === 'slate') {
    normalizedProfile = 'violet'
  } else if (colorProfile === 'zinc' || colorProfile === 'neutral' || colorProfile === 'stone' || colorProfile === 'stillwater') {
    normalizedProfile = 'charcoal'
  }

  // Set Profile Attribute (Source of truth for CSS variables in globals.css)
  root.setAttribute('data-color-profile', normalizedProfile)

  // Apply font stack
  const fontStack = `'${font}', sans-serif`
  
  root.style.setProperty('--font-body', fontStack)
  document.body.style.fontFamily = fontStack
}
