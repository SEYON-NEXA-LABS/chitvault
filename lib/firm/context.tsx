'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { can } from '@/lib/firm/permissions'
import { applyBranding } from '@/lib/branding/context'
import type { Firm, Profile, UserRole, SubscriptionStatus } from '@/types'
import type { Permission } from '@/lib/firm/permissions'

interface FirmContext {
  firm:    Firm | null
  profile: Profile | null
  role:    UserRole | null
  loading: boolean
  can:     (action: Permission) => boolean
  refresh: () => Promise<void>
  status:  SubscriptionStatus
  switchedFirmId: string | 'all'
  setSwitchedFirmId: (id: string | 'all') => void
}

const Ctx = createContext<FirmContext>({
  firm: null, profile: null, role: null, loading: true, status: 'active',
  can: () => false, refresh: async () => {},
  switchedFirmId: 'all', setSwitchedFirmId: () => {}
})

export function FirmProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
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
    try {
      if (!silent) setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) { 
        setProfile(null)
        setFirm(null)
        setLoading(false)
        return 
      }
      
      // Load profile
      const { data: dbProfile, error: profErr } = await supabase
        .from('profiles').select('id, firm_id, role, status, full_name').eq('id', user.id).maybeSingle()
      
      if (profErr) console.error('Profile fetch error:', profErr)
      setProfile(dbProfile)
      
      // Determine active firm ID: use switchedFirmId if superadmin
      const dbRole = dbProfile?.role as UserRole | null
      const activeFirmId = (dbRole === 'superadmin' && switchedFirmId !== 'all') 
        ? switchedFirmId 
        : dbProfile?.firm_id

      // Load firm if active ID exists
      if (activeFirmId) {
        const { data: f } = await supabase
          .from('firms')
          .select('id, name, slug, font, color_profile, plan, plan_status, trial_ends, address, phone, register_token, enabled_schemes')
          .eq('id', activeFirmId)
          .maybeSingle()
        setFirm(f)
        if (f) applyBranding(f.font || 'Noto Sans', f.color_profile || 'indigo')
      } else {
        setFirm(null)
        // Reset branding to default if global
        applyBranding('Noto Sans', 'indigo')
      }
    } catch (err) {
      console.warn('FirmProvider Initialization Failed (Offline?):', err)
    } finally {
      setLoading(false)
    }
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

  const status = useMemo((): SubscriptionStatus => {
    const calculatedStatus = ((): SubscriptionStatus => {
      if (!firm) return 'active'
      if (firm.plan_status === 'suspended') return 'locked'
      
      if (!firm.trial_ends) return 'active'
      const expiry = new Date(firm.trial_ends)
      const today = new Date()
      const diff = today.getTime() - expiry.getTime()
      const daysOverdue = Math.ceil(diff / (1000 * 60 * 60 * 24))

      if (daysOverdue <= 0) return 'active'
      
      // Perpetual clients never get locked out, they remain active for data entry even if AMC expires
      if (firm.plan === 'perpetual') return 'active'
      
      // Standard/Enterprise get 7 days grace then lockout
      if (daysOverdue > 7) return 'locked'
      
      return 'restricted'
    })()

    return calculatedStatus
  }, [firm])

  const value = useMemo(() => ({
    firm, profile, role, loading, status,
    can: (action: Permission) => {
      // Global restriction: if status is restricted, block data-entry permissions
      if (status === 'restricted') {
        const dataEntryActions: Permission[] = ['addMember', 'createGroup', 'recordAuction', 'recordPayment', 'inviteStaff']
        if (dataEntryActions.includes(action)) return false
      }
      return can(role, action)
    },
    refresh: load,
    switchedFirmId,
    setSwitchedFirmId: handleSwitch
  }), [firm, profile, role, loading, status, load, switchedFirmId, handleSwitch])

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
}

export function useFirm() { return useContext(Ctx) }
