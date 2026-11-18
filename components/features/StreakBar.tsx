'use client'

import React from 'react'
import type { StreakEntry } from '@/lib/utils/chitLogic'
import { fmt, fmtDate, fmtMonth, cn } from '@/lib/utils'

interface StreakBarProps {
  streak: StreakEntry[]
  startDate?: string | null
  maxMonths?: number
  compact?: boolean
}

export function StreakBar({ streak, startDate, maxMonths = 12, compact = false }: StreakBarProps) {
  if (!streak || streak.length === 0) return null

  const items = streak.slice(0, maxMonths)

  return (
    <div className="flex items-center gap-1">
      {items.map(s => {
        const monthLabel = fmtMonth(s.month, startDate, `M${s.month}`, s.auctionDate)
        
        let tooltip = `${monthLabel}`
        if (s.hasAuctionHappened) {
          tooltip += `\n• Auction: Recorded${s.auctionDate ? ` on ${fmtDate(s.auctionDate)}` : ''}`
          if (s.winnerName) tooltip += ` (Winner: ${s.winnerName})`
        } else {
          tooltip += `\n• Auction: Pending / Not Yet Recorded`
        }

        if (s.status === 'success') {
          tooltip += `\n• Payment: Fully Paid (₹${s.paid.toLocaleString('en-IN')})`
        } else if (s.status === 'danger') {
          tooltip += `\n• Payment: Unpaid / Defaulted (Due: ₹${s.due.toLocaleString('en-IN')})`
        } else if (s.status === 'info') {
          tooltip += `\n• Payment: Current Cycle (Due: ₹${s.due.toLocaleString('en-IN')})`
        } else {
          tooltip += `\n• Payment: Future Month`
        }

        // Visual styles:
        // - hasAuctionHappened: solid crisp block
        // - !hasAuctionHappened: striped / translucent / hollow outline
        const isRecorded = s.hasAuctionHappened
        const isPaid = s.status === 'success'
        const isDefaulter = s.status === 'danger'
        const isCurrent = s.status === 'info'

        return (
          <div
            key={s.month}
            title={tooltip}
            className={cn(
              "relative rounded-[3px] transition-all cursor-pointer group hover:scale-125",
              compact ? "w-2 h-3" : "w-2.5 h-5",
              // Auction recorded vs. pending borders
              isRecorded ? "ring-1 ring-black/20" : "border border-dashed border-slate-300",
              // Colors
              isPaid && isRecorded && "bg-emerald-500",
              isPaid && !isRecorded && "bg-emerald-400/60", // Advance payment for unrecorded auction
              isDefaulter && isRecorded && "bg-red-500 animate-pulse",
              isCurrent && !isRecorded && "bg-amber-400 ring-1 ring-amber-500",
              s.status === 'gray' && "bg-slate-200/60"
            )}
          >
            {/* Small top indicator dot if auction was recorded */}
            {isRecorded && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-900/60" />
            )}
          </div>
        )
      })}
    </div>
  )
}

