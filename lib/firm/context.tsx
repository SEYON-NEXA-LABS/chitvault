'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { can } from '@/lib/firm/permissions'
import { applyBranding } from '@/lib/branding/context'
import type { Firm, Profile, UserRole } from '@/types'
import type { Permission } from '@/lib/firm/permissions'

interface FirmContext {
  firm:    Firm | null
  profile: Profile | null
  role:    UserRole | null
  loading: boolean
  can:     (action: Permission) => boolean
  refresh: () => Promise<void>
  switchedFirmId: string | 'all'
  setSwitchedFirmId: (id: string | 'all') => void
}

const Ctx = createContext<FirmContext>({
  firm: null, profile: null, role: null, loading: true,
  can: () => false, refresh: async () => {},
  switchedFirmId: 'all', setSwitchedFirmId: () => {}
})

export function FirmProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [firm,    setFirm]    = useState<Firm | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [switchedFirmId, setSwitchedFirmId] = useState<string | 'all'>('all')

  useEffect(() => {
    const saved = localStorage.getItem('switched_firm_id') || 'all'
    setSwitchedFirmId(saved)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) { 
      setProfile(null)
      setFirm(null)
      setLoading(false)
      return 
    }
    
    // Load profile
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()
    
    setProfile(prof)
    
    // Determine active firm ID: use switchedFirmId if superadmin
    const role = prof?.role as UserRole | null
    const activeFirmId = (role === 'superadmin' && switchedFirmId !== 'all') 
      ? switchedFirmId 
      : prof?.firm_id

    // Load firm if active ID exists
    if (activeFirmId) {
      const { data: f } = await supabase
        .from('firms').select('*').eq('id', activeFirmId).maybeSingle()
      setFirm(f)
      if (f) applyBranding(f.font || 'Noto Sans', f.color_profile || 'indigo')
    } else {
      setFirm(null)
      // Reset branding to default if global
      applyBranding('Noto Sans', 'indigo')
    }
    
    setLoading(false)
  }, [supabase, switchedFirmId])

  const handleSwitch = useCallback((id: string | 'all') => {
    setSwitchedFirmId(id)
    localStorage.setItem('switched_firm_id', id)
  }, [])

  useEffect(() => { 
    // Initial load
    load()

    // Listen for auth changes (Login/Logout/Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      // Use silent reload for background events
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
         load(true)
      } else if (event === 'SIGNED_IN') {
         load()
      } else if (event === 'SIGNED_OUT') {
         setProfile(null)
         setFirm(null)
         setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [load, supabase])

  const role = profile?.role as UserRole | null ?? null

  const value = useMemo(() => ({
    firm, profile, role, loading,
    can: (action: Permission) => can(role, action),
    refresh: load,
    switchedFirmId,
    setSwitchedFirmId: handleSwitch
  }), [firm, profile, role, loading, load, switchedFirmId, handleSwitch])

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
}

export function useFirm() { return useContext(Ctx) }
