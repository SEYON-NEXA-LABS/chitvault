import { useEffect, createContext, useContext } from 'react'
import type { Firm } from '@/types'
import { getTheme } from './themes'

interface BrandingContext {
  color: string
  accent: string
  bg: string
  name: string
  tagline: string
  font: string
  logoUrl: string | null
}

const Ctx = createContext<BrandingContext>({
  color: '#2563eb', accent: '#1e40af', bg: '#0b0d12', name: 'Seyon Chit Vault',
  tagline: 'Chit Fund Manager', font: 'Noto Sans', logoUrl: null
})

export function BrandingProvider({ firm, children }: {
  firm: Firm | null; children: React.ReactNode
}) {
  const theme = getTheme(firm?.theme_id)

  const color = firm?.primary_color || theme.primary
  const accent = firm?.accent_color || theme.accent
  const bg = theme.bg
  const name = firm?.name || process.env.NEXT_PUBLIC_APP_NAME || 'SEYON ChitVault'
  const tagline = firm?.tagline || 'Chit Fund Manager'
  const font = firm?.font || 'Noto Sans'
  const logoUrl = firm?.logo_url || null

  useEffect(() => {
    applyBranding(color, font, accent, bg)
  }, [color, font, accent, bg])

  return (
    <Ctx.Provider value={{ color, accent, bg, name, tagline, font, logoUrl }}>
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

export const PRESET_COLORS = [
  { label: 'Primary Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Rose', value: '#e11d48' },
]

// Apply CSS variables + load Google Font dynamically
export function applyBranding(color: string, font: string, accent: string = '#1e40af', bg: string = '#0b0d12') {
  const root = document.documentElement

  // Set primary colors
  root.style.setProperty('--gold', color)
  root.style.setProperty('--gold-light', lighten(color, 0.2))
  root.style.setProperty('--gold-dim', alpha(color, 0.15))
  root.style.setProperty('--gold-border', alpha(color, 0.4))

  // Set accent colors
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-dim', alpha(accent, 0.15))
  root.style.setProperty('--accent-border', alpha(accent, 0.4))

  // Set background color
  root.style.setProperty('--bg-firm', bg)
  // If BG is light (white/ivory), we might need to adjust some surface colors, 
  // but for now we'll just expose the variable.

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

// Colour helpers
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function lighten(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex)
  const l = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount))
  return `#${l(r).toString(16).padStart(2, '0')}${l(g).toString(16).padStart(2, '0')}${l(b).toString(16).padStart(2, '0')}`
}

function alpha(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
