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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    
    // Use maybeSingle() to avoid 406 when profile doesn't exist
    const { data: prof, error: profError } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()
    
    // If no profile exists, try to create one for dev firm
    if (!prof && profError?.code === 'PGRST116') {
      const { data: newProf, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          firm_id: '7e92aa8b-ca5e-4e70-af7d-a4d166ba9a2c', // Dev firm from seed_dev_firm.sql
          full_name: user.email?.split('@')[0] || 'User',
          role: 'staff'
        })
        .select('*')
        .maybeSingle()
      
      if (newProf) {
        setProfile(newProf)
        // Load firm if profile has firm_id
        if (newProf.firm_id) {
          const { data: f } = await supabase
            .from('firms').select('*').eq('id', newProf.firm_id).maybeSingle()
          setFirm(f)
          if (f) applyBranding(f.primary_color || '#2563eb', f.font || 'DM Sans')
        }
        setLoading(false)
        return
      }
    }
    
    setProfile(prof)
    
    // Load firm if profile exists with firm_id
    if (prof?.firm_id) {
      const { data: f } = await supabase
        .from('firms').select('*').eq('id', prof.firm_id).maybeSingle()
      setFirm(f)
      if (f) applyBranding(f.primary_color || '#2563eb', f.font || 'DM Sans')
    }
    setLoading(false)
  }, [supabase])

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
