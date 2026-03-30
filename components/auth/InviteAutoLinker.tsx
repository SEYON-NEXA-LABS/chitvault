'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Automatically links a newly confirmed user to their firm 
 * if they have a pending invite ID in localStorage.
 */
export function InviteAutoLinker() {
  const supabase = createClient()

  useEffect(() => {
    async function checkPending() {
      const inviteId = localStorage.getItem('pending_invite_id')
      if (!inviteId) return

      // Must be authenticated to call accept_invite RPC
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Check if they are already linked 
      // (RPC does this too, but we can avoid the call if already in a firm)
      const { data: prof } = await supabase
        .from('profiles')
        .select('firm_id')
        .eq('id', user.id)
        .maybeSingle()

      if (prof?.firm_id) {
        localStorage.removeItem('pending_invite_id')
        return
      }

      // 2. Try to link them via the RPC
      const { error: rpcErr } = await supabase.rpc('accept_invite', { invite_id: inviteId })
      
      if (!rpcErr) {
        // Success! Clear the marker and refresh the app state
        localStorage.removeItem('pending_invite_id')
        window.location.replace('/dashboard')
      }
    }

    // Run slightly delayed to ensure auth session is hydrated if using SSR
    const timer = setTimeout(checkPending, 1000)
    return () => clearTimeout(timer)
  }, [supabase])

  return null
}
