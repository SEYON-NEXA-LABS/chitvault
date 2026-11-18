'use client'

import React, { useEffect, useState } from 'react'
import { Languages, ChevronDown, Check } from 'lucide-react'

declare global {
  interface Window {
    google: any
    googleTranslateElementInit: () => void
  }
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
]

export function GoogleTranslateEmbed() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState('en')
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    // Check if script is already added
    if (document.getElementById('google-translate-script')) {
      setScriptLoaded(true)
      return
    }

    // Define initialization function
    window.googleTranslateElementInit = () => {
      try {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,ta,hi,te,kn,ml,mr,gu,bn',
            autoDisplay: false,
            layout: window.google.translate.TranslateElement.InlineLayout?.SIMPLE,
          },
          'google_translate_element'
        )
        setScriptLoaded(true)
      } catch (e) {
        console.error('Google Translate Init Error:', e)
      }
    }

    // Inject Google Translate script
    const script = document.createElement('script')
    script.id = 'google-translate-script'
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    script.async = true
    document.body.appendChild(script)

    // Detect currently set cookie if any
    const match = document.cookie.match(/googtrans=\/en\/([a-z]{2})/i)
    if (match && match[1]) {
      setCurrentLang(match[1].toLowerCase())
    }
  }, [])

  const changeLanguage = (langCode: string) => {
    setCurrentLang(langCode)
    setIsOpen(false)

    // Set Google Translate cookie (works across domains / paths)
    const domain = window.location.hostname
    const cookieValue = langCode === 'en' ? '/en/en' : `/en/${langCode}`
    
    document.cookie = `googtrans=${cookieValue}; path=/;`
    if (domain !== 'localhost') {
      document.cookie = `googtrans=${cookieValue}; domain=.${domain}; path=/;`
    }

    // Trigger select dropdown if rendered by Google widget
    const selectElem = document.querySelector<HTMLSelectElement>('.goog-te-combo')
    if (selectElem) {
      selectElem.value = langCode
      selectElem.dispatchEvent(new Event('change'))
    } else {
      // Reload to apply translation cleanly
      window.location.reload()
    }
  }

  const activeLangObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0]

  return (
    <div className="relative inline-block notranslate" translate="no">
      {/* Hidden container for Google's internal engine element */}
      <div id="google_translate_element" className="hidden" />

      {/* Styled Modern Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface2)] border border-[var(--border)] shadow-sm text-xs font-semibold text-[var(--text)] transition-all hover:scale-[1.02] active:scale-95"
        title="Translate Help Guide"
      >
        <div className="w-5 h-5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center">
          <Languages size={13} />
        </div>
        <span className="font-bold tracking-tight">{activeLangObj.native}</span>
        <ChevronDown size={13} className={`opacity-40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu overlay */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-48 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
            <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text3)] border-b border-[var(--border)] mb-1">
              Select Language
            </div>
            <div className="space-y-0.5 max-h-56 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map(lang => {
                const isSelected = lang.code === currentLang
                return (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected 
                        ? 'bg-[var(--accent-dim)] text-[var(--accent)] font-bold' 
                        : 'text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{lang.native}</span>
                      <span className="text-[10px] opacity-40 font-mono">({lang.label})</span>
                    </div>
                    {isSelected && <Check size={14} className="text-[var(--accent)] shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
