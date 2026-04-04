'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'system' | 'monochrome'

interface ThemeContextType {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  fontSize: number
  setFontSize: (size: number) => void
  monochrome: boolean
  setMonochrome: (mono: boolean) => void
  toggleTheme: () => void
  adjustFont: (delta: number) => void
  toggleMono: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light')
  const [fontSize, setFontSizeState] = useState(16)
  const [monochrome, setMonochromeState] = useState(false)

  // Initialize from localStorage
  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') || 'light') as ThemeMode
    const savedSize = parseInt(localStorage.getItem('fontSize') || '16')
    const savedMono = localStorage.getItem('monochrome') === 'true'

    setThemeState(savedTheme)
    setFontSizeState(savedSize)
    setMonochromeState(savedMono)

    applyTheme(savedTheme)
    applyFontSize(savedSize)
    applyMono(savedMono)
  }, [])

  const applyTheme = (t: ThemeMode) => {
    document.documentElement.setAttribute('data-theme', t)
    
    // Sync "active" theme for flickering prevention script
    const supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const active = t === 'system' ? (supportDark ? 'dark' : 'light') : t
    document.documentElement.setAttribute('data-active-theme', active)
    
    // Special handling for monochrome mode if selected as theme
    if (t === 'monochrome') {
      applyMono(true)
    } else {
      // Restore previous mono state if switching away from monochrome theme
      const savedMono = localStorage.getItem('monochrome') === 'true'
      applyMono(savedMono)
    }
  }

  const applyFontSize = (size: number) => {
    document.documentElement.style.setProperty('--font-size-base', `${size}px`)
  }

  const applyMono = (mono: boolean) => {
    document.documentElement.classList.toggle('grayscale-mode', mono)
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

  const setMonochrome = (mono: boolean) => {
    setMonochromeState(mono)
    localStorage.setItem('monochrome', String(mono))
    applyMono(mono)
    
    // If manually toggling mono, and theme is 'monochrome', maybe update theme?
    // For now, let's keep them somewhat independent but coordinated.
    if (!mono && theme === 'monochrome') {
      setTheme('light') // default back to light if mono is disabled while in mono theme
    }
  }

  const toggleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system', 'monochrome']
    const next = modes[(modes.indexOf(theme) + 1) % modes.length]
    setTheme(next)
  }

  const adjustFont = (delta: number) => {
    setFontSize(fontSize + delta)
  }

  const toggleMono = () => {
    setMonochrome(!monochrome)
  }

  return (
    <ThemeContext.Provider value={{ 
      theme, setTheme, 
      fontSize, setFontSize, 
      monochrome, setMonochrome,
      toggleTheme, adjustFont, toggleMono
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
