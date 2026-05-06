'use client'

import { useState, useEffect } from 'react'
import { Cookie, X } from 'lucide-react'

export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const checkConsent = () => {
      const consent = localStorage.getItem('chitvault-cookie-consent')
      if (consent === 'true') setShow(false)
      else if (!consent) {
        // Show after a short delay for subtle effect
        const timer = setTimeout(() => setShow(true), 2000)
        return () => clearTimeout(timer)
      }
    }

    checkConsent()

    // Listen for storage changes from login page or other tabs
    window.addEventListener('storage', checkConsent)
    window.addEventListener('cookie-consent-updated', checkConsent)

    return () => {
      window.removeEventListener('storage', checkConsent)
      window.removeEventListener('cookie-consent-updated', checkConsent)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('chitvault-cookie-consent', 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-6 left-6 z-[10000] animate-in slide-in-from-bottom-5 fade-in duration-500 no-print">
      <div className="cookie-banner">
        <div className="w-10 h-10 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] shrink-0">
          <Cookie size={20} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-[var(--text2)] leading-relaxed font-medium">
            We use essential cookies for authentication and performance. By continuing, you agree to our use of these tools.
          </p>
        </div>

        <button 
          onClick={handleAccept}
          className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] hover:opacity-70 px-4 py-2 bg-[var(--accent-dim)] rounded-xl transition-all"
        >
          Got it
        </button>
        
        <button 
          onClick={() => setShow(false)}
          className="p-1 opacity-20 hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
