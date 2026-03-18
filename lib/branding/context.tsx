'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Firm } from '@/types'

// Google Fonts available for selection
export const AVAILABLE_FONTS = [
  { label: 'DM Sans (Default)',     value: 'DM Sans'     },
  { label: 'Inter',                 value: 'Inter'        },
  { label: 'Poppins',              value: 'Poppins'      },
  { label: 'Nunito',               value: 'Nunito'       },
  { label: 'Lato',                 value: 'Lato'         },
  { label: 'Roboto',               value: 'Roboto'       },
  { label: 'Open Sans',            value: 'Open Sans'    },
  { label: 'Mukta (Tamil/Hindi)',  value: 'Mukta'        },
  { label: 'Hind (Tamil/Hindi)',   value: 'Hind'         },
  { label: 'Noto Sans',            value: 'Noto Sans'    },
]

export const PRESET_COLORS = [
  { label: 'Gold (Default)', value: '#c9a84c' },
  { label: 'Deep Blue',      value: '#2563eb' },
  { label: 'Emerald',        value: '#059669' },
  { label: 'Purple',         value: '#7c3aed' },
  { label: 'Rose',           value: '#e11d48' },
  { label: 'Teal',           value: '#0d9488' },
  { label: 'Indigo',         value: '#4338ca' },
  { label: 'Amber',          value: '#d97706' },
  { label: 'Slate',          value: '#475569' },
  { label: 'Custom',         value: 'custom'  },
]

interface BrandingContext {
  color:   string
  name:    string
  tagline: string
  font:    string
  logoUrl: string | null
}

const Ctx = createContext<BrandingContext>({
  color: '#c9a84c', name: 'ChitVault',
  tagline: 'Chit Fund Manager', font: 'DM Sans', logoUrl: null
})

export function BrandingProvider({ firm, children }: {
  firm: Firm | null; children: React.ReactNode
}) {
  const color   = firm?.primary_color || '#c9a84c'
  const name    = firm?.name    || process.env.NEXT_PUBLIC_APP_NAME || 'ChitVault'
  const tagline = firm?.tagline || 'Chit Fund Manager'
  const font    = firm?.font    || 'DM Sans'
  const logoUrl = firm?.logo_url || null

  useEffect(() => {
    applyBranding(color, font)
  }, [color, font])

  return (
    <Ctx.Provider value={{ color, name, tagline, font, logoUrl }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBranding() { return useContext(Ctx) }

// Apply CSS variables + load Google Font dynamically
export function applyBranding(color: string, font: string) {
  const root = document.documentElement

  // Set primary colour and derived tints
  root.style.setProperty('--gold', color)
  root.style.setProperty('--gold-light', lighten(color, 0.2))
  root.style.setProperty('--gold-dim',   alpha(color, 0.15))
  root.style.setProperty('--gold-border', alpha(color, 0.4))

  // Load Google Font if not already loaded
  const fontId = `gfont-${font.replace(/\s+/g, '-').toLowerCase()}`
  if (!document.getElementById(fontId) && font !== 'DM Sans') {
    const link     = document.createElement('link')
    link.id        = fontId
    link.rel       = 'stylesheet'
    link.href      = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g,'+')}:wght@300;400;500;600;700&display=swap`
    document.head.appendChild(link)
  }

  // Apply font
  root.style.setProperty('--font-body', `'${font}', sans-serif`)
  document.body.style.fontFamily = `'${font}', sans-serif`
}

// Colour helpers
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return { r, g, b }
}

function lighten(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex)
  const l = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount))
  return `#${l(r).toString(16).padStart(2,'0')}${l(g).toString(16).padStart(2,'0')}${l(b).toString(16).padStart(2,'0')}`
}

function alpha(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
