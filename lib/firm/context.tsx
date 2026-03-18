'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (prof?.firm_id) {
      const { data: f } = await supabase
        .from('firms').select('*').eq('id', prof.firm_id).single()
      setFirm(f)
      // Apply branding as soon as firm loads
      if (f) applyBranding(f.primary_color || '#c9a84c', f.font || 'DM Sans')
    }
    setProfile(prof)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const role = profile?.role as UserRole | null ?? null

  return (
    <Ctx.Provider value={{
      firm, profile, role, loading,
      can: (action: Permission) => can(role, action),
      refresh: load
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useFirm() { return useContext(Ctx) }
