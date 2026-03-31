'use client'

import React, { useState, useEffect } from 'react'
import { Lock, Delete, X } from 'lucide-react'

interface PinOverlayProps {
  onUnlock: (pin: string) => boolean
}

export function PinOverlay({ onUnlock }: PinOverlayProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Enter') {
        handleSubmit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pin]) // Re-bind when pin changes so handlers have fresh state

  const handleKey = (num: string) => {
    if (pin.length >= 6) return
    setError(false)
    const next = pin + num
    setPin(next)
  }

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1))
    setError(false)
  }

  const handleSubmit = () => {
    if (onUnlock(pin)) {
      setPin('')
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-500">
      <div className={`w-80 p-8 rounded-[40px] border border-white/10 bg-white/5 shadow-2xl flex flex-col items-center transition-transform duration-300 ${error ? 'animate-shake' : ''}`}>
        
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-6 border border-accent/20 shadow-[0_0_20px_rgba(201,168,76,0.2)]">
          <Lock className="text-accent" size={24} />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Desktop Locked</h2>
        <p className="text-xs text-white/40 mb-8 tracking-widest uppercase font-bold">Enter Security PIN</p>

        {/* Pin Dots */}
        <div className="flex gap-4 mb-10">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} 
              className={`w-3 h-3 rounded-full border transition-all duration-200 ${
                pin.length >= i ? 'bg-accent border-accent scale-125 shadow-[0_0_10px_#c9a84c]' : 'bg-transparent border-white/20'
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button key={num} onClick={() => handleKey(num)}
              className="w-full aspect-square rounded-full flex items-center justify-center text-xl font-medium text-white hover:bg-white/10 active:scale-95 transition-all border border-transparent hover:border-white/10">
              {num}
            </button>
          ))}
          <button onClick={handleBackspace}
            className="w-full aspect-square rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 active:scale-95 transition-all">
            <Delete size={20} />
          </button>
          <button onClick={() => handleKey('0')}
            className="w-full aspect-square rounded-full flex items-center justify-center text-xl font-medium text-white hover:bg-white/10 active:scale-95 transition-all border border-transparent hover:border-white/10">
            0
          </button>
          <button onClick={handleSubmit}
            className="w-full aspect-square rounded-full flex items-center justify-center text-accent font-bold hover:bg-accent/20 active:scale-95 transition-all border border-accent/20">
            OK
          </button>
        </div>

        {error && (
          <div className="mt-6 text-danger-400 text-xs font-bold tracking-tight animate-bounce">
            Incorrect PIN. Try again.
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  )
}
