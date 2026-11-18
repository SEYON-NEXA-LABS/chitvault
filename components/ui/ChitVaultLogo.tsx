import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number | string
  className?: string
  showText?: boolean
  textClassName?: string
  subtitle?: string
}

export function ChitVaultLogo({
  size = 36,
  className,
  showText = false,
  textClassName,
  subtitle
}: LogoProps) {
  const numericSize = typeof size === 'number' ? size : parseInt(size, 10) || 36

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <div 
        className="relative shrink-0 overflow-hidden transition-transform hover:scale-105 duration-300 rounded-xl"
        style={{ width: numericSize, height: numericSize }}
      >
        <Image
          src="/icons/icon-512.png"
          alt="ChitVault"
          width={numericSize}
          height={numericSize}
          className="w-full h-full object-contain"
          priority
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              'font-brand tracking-wider text-[#1e3360] leading-none select-none font-black',
              textClassName || 'text-xl'
            )}
            translate="no"
          >
            ChitVault
          </span>
          {subtitle && (
            <span className="text-[10px] font-bold text-[#1e3360]/60 uppercase tracking-widest leading-none mt-1 select-none">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
