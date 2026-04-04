'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Btn } from './index'
import { ChevronRight, ChevronLeft, X, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PATH_TO_TOUR } from '@/lib/tour/config'
import { usePathname } from 'next/navigation'

// ── Types ───────────────────────────────────────────────────────────────────
export interface TourStep {
  target: string; // CSS Selector
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  nextLabel?: string;
}

interface TourContextType {
  startTour: (steps: TourStep[]) => void;
  startCurrentPageTour: () => void;
  stopTour: () => void;
  currentStep: number;
  totalSteps: number;
  isActive: boolean;
  hasTourForPage: boolean;
}

const TourContext = createContext<TourContextType | null>(null)

export const useTour = () => {
  const context = useContext(TourContext)
  if (!context) throw new Error('useTour must be used within TourProvider')
  return context
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [steps, setSteps] = useState<TourStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const hasTourForPage = !!PATH_TO_TOUR[pathname]
  
  const startTour = (newSteps: TourStep[]) => {
    setSteps(newSteps)
    setCurrentStep(0)
    setIsActive(true)
  }

  const startCurrentPageTour = () => {
    const pageSteps = PATH_TO_TOUR[pathname]
    if (pageSteps) {
      startTour(pageSteps)
    }
  }

  const stopTour = () => {
    setIsActive(false)
    setTargetRect(null)
  }

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      stopTour()
    }
  }

  const prev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }

  // Update target rectangle position
  useEffect(() => {
    if (!isActive || !steps[currentStep]) return

    const update = () => {
      const el = document.querySelector(steps[currentStep].target)
      if (el) {
        setTargetRect(el.getBoundingClientRect())
        // Scroll into view if needed
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        // If element missing, skip or wait? Let's hide spotlight
        setTargetRect(null)
      }
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [isActive, currentStep, steps])

  return (
    <TourContext.Provider value={{ startTour, startCurrentPageTour, stopTour, currentStep, totalSteps: steps.length, isActive, hasTourForPage }}>
      {children}
      {isActive && steps[currentStep] && (
        <TourOverlay 
          step={steps[currentStep]} 
          rect={targetRect} 
          index={currentStep} 
          total={steps.length}
          onNext={next}
          onPrev={prev}
          onClose={stopTour}
        />
      )}
    </TourContext.Provider>
  )
}

// ── Overlay Component ────────────────────────────────────────────────────────
function TourOverlay({ step, rect, index, total, onNext, onPrev, onClose }: any) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  // Spotlight logic using CSS transition
  const spotlightStyle: React.CSSProperties = rect ? {
    top: rect.top - 8,
    left: rect.left - 8,
    width: rect.width + 16,
    height: rect.height + 16,
    borderRadius: '16px',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
  } : { opacity: 0 }

  // Popover positioning
  const popoverStyle: React.CSSProperties = rect ? {
    top: rect.top + rect.height + 24,
    left: Math.max(20, Math.min(window.innerWidth - 340, rect.left + rect.width / 2 - 160)),
    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
  } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Target Mask / Spotlight */}
      <div className="absolute border-2 border-[var(--accent)] shadow-[0_0_20px_var(--accent)] pointer-events-auto" style={spotlightStyle} />

      {/* Popover Card */}
      <div className="absolute w-[320px] pointer-events-auto bg-[var(--surface)] border border-[var(--border)] rounded-[24px] shadow-2xl p-6 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300"
        style={popoverStyle}>
        
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] text-[9px] font-black uppercase tracking-widest">
              <Compass size={10} className="animate-spin-slow" />
              Step {index + 1} / {total}
           </div>
           <button onClick={onClose} className="p-1 hover:bg-[var(--surface2)] rounded-full transition-colors">
              <X size={14} className="opacity-40" />
           </button>
        </div>

        <h3 className="text-sm font-black uppercase tracking-wider mb-2" style={{ color: 'var(--text)' }}>
           {step.title}
        </h3>
        <p className="text-xs opacity-60 leading-relaxed mb-6">
           {step.content}
        </p>

        <div className="flex items-center justify-between gap-3">
           <div className="flex gap-2">
              <button 
                onClick={onPrev} 
                disabled={index === 0}
                className="p-2 rounded-xl border border-[var(--border)] disabled:opacity-20 hover:bg-[var(--surface2)] transition-all">
                <ChevronLeft size={16} />
              </button>
           </div>
           <Btn size="sm" variant="primary" onClick={onNext} className="flex-1">
              {index === total - 1 ? 'Finish Tour' : (step.nextLabel || 'Next Signal')}
              <ChevronRight size={14} className="ml-1" />
           </Btn>
        </div>

        {/* Audit Meta */}
        <div className="mt-6 pt-4 border-t border-[var(--border)] opacity-20 text-[7px] font-black uppercase tracking-[0.3em] flex justify-between">
           <span>Audit Protocol Alpha-9</span>
           <span>Tour Layer 1.0</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
