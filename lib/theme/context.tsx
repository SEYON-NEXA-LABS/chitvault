'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  fontSize: number
  setFontSize: (size: number) => void
  toggleTheme: () => void
  adjustFont: (delta: number) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light')
  const [fontSize, setFontSizeState] = useState(16)

  // Initialize from localStorage
  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') || 'light') as ThemeMode
    const savedSize = parseInt(localStorage.getItem('fontSize') || '16')

    setThemeState(savedTheme)
    setFontSizeState(savedSize)

    applyTheme(savedTheme)
    applyFontSize(savedSize)
  }, [])

  const applyTheme = (t: ThemeMode) => {
    document.documentElement.setAttribute('data-theme', t)
    
    // Sync "active" theme for flickering prevention script
    const supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const active = t === 'system' ? (supportDark ? 'dark' : 'light') : t
    document.documentElement.setAttribute('data-active-theme', active)
  }

  const applyFontSize = (size: number) => {
    document.documentElement.style.setProperty('--font-size-base', `${size}px`)
  }

  const setTheme = (t: ThemeMode) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
    applyTheme(t)
  }

  const setFontSize = (size: number) => {
    const next = Math.min(20, Math.max(12, size))
    setFontSizeState(next)
    localStorage.setItem('fontSize', String(next))
    applyFontSize(next)
  }

  const toggleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const next = modes[(modes.indexOf(theme) + 1) % modes.length]
    setTheme(next)
  }

  const adjustFont = (delta: number) => {
    setFontSize(fontSize + delta)
  }

  return (
    <ThemeContext.Provider value={{ 
      theme, setTheme, 
      fontSize, setFontSize, 
      toggleTheme, adjustFont
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
