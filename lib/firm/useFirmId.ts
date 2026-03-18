'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useFirmId() {
  const supabase = createClient()
  const [firmId, setFirmId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('firm_id').eq('id', user.id).maybeSingle()
      setFirmId(data?.firm_id || null)
    })
  }, [])

  return firmId
}
