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
}

const Ctx = createContext<FirmContext>({
  firm: null, profile: null, role: null, loading: true,
  can: () => false, refresh: async () => {}
})

export function FirmProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [firm,    setFirm]    = useState<Firm | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

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
    
    // Load firm if profile exists with firm_id
    if (prof?.firm_id) {
      const { data: f } = await supabase
        .from('firms').select('*').eq('id', prof.firm_id).maybeSingle()
      setFirm(f)
      if (f) applyBranding(f.primary_color || '#2563eb', f.font || 'Noto Sans')
    } else {
      setFirm(null)
    }
    
    setLoading(false)
  }, [supabase])

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
    refresh: load
  }), [firm, profile, role, loading, load])

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
}

export function useFirm() { return useContext(Ctx) }
