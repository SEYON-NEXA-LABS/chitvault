'use client'

import React from 'react'
import { getGroupTheme, type GroupTheme } from '@/lib/utils/groupTheme'

interface GroupBadgeProps {
  groupId?: number | string
  groupName?: string
  ticketNo?: string | number
  amount?: string
  size?: 'xs' | 'sm' | 'md'
  showIcon?: boolean
  showTicket?: boolean
  showShortCode?: boolean
  className?: string
  onClick?: () => void
  theme?: GroupTheme
}

export function GroupBadge({
  groupId,
  groupName = 'Chit Group',
  ticketNo,
  amount,
  size = 'sm',
  showIcon = true,
  showTicket = true,
  showShortCode = false,
  className = '',
  onClick,
  theme: customTheme
}: GroupBadgeProps) {
  const theme = customTheme || getGroupTheme(0, groupId || groupName, groupName)
  const Icon = theme.icon

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2'
  }

  const iconSizes = {
    xs: 11,
    sm: 13,
    md: 15
  }

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface2)] font-medium text-[var(--text)] transition-all ${sizeClasses[size]} ${
        onClick ? 'cursor-pointer hover:bg-[var(--surface3)]' : ''
      } ${className}`}
    >
      {showIcon && (
        <span className="flex items-center justify-center shrink-0 text-[var(--text)] opacity-90">
          <Icon size={iconSizes[size]} strokeWidth={2.4} />
        </span>
      )}
      
      {showShortCode && (
        <span className="font-mono text-[9px] font-black uppercase px-1 py-0.2 rounded bg-[var(--surface)] border border-[var(--border)] tracking-tight">
          {theme.shortCode}
        </span>
      )}

      <span className="font-bold truncate">{groupName}</span>

      {showTicket && ticketNo != null && (
        <span className="text-[10px] opacity-75 font-mono">#{ticketNo}</span>
      )}

      {amount && (
        <span className="font-black font-mono text-[var(--text)] opacity-90">
          ({amount})
        </span>
      )}
    </span>
  )
}

export function GroupAvatar({
  groupId,
  groupName,
  size = 28,
  iconSize = 14,
  className = ''
}: {
  groupId?: number | string
  groupName?: string
  size?: number
  iconSize?: number
  className?: string
}) {
  const theme = getGroupTheme(0, groupId || groupName, groupName)
  const Icon = theme.icon

  return (
    <div
      className={`rounded-lg flex items-center justify-center shrink-0 border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
      }}
      title={groupName || theme.label}
    >
      <Icon size={iconSize} strokeWidth={2.2} />
    </div>
  )
}
