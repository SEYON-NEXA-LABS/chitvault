'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UsageInsights } from '@/types'

const USAGE_CACHE_KEY = 'chitvault_usage_cache'
const USAGE_TIMESTAMP_KEY = 'chitvault_usage_timestamp'
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

export function useUsage(firmId: string | undefined) {
  const supabase = createClient()
  const [data, setData] = useState<UsageInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const fetchUsage = useCallback(async (force = false) => {
    if (!firmId) return
    
    // Check Cache
    const cachedData = localStorage.getItem(USAGE_CACHE_KEY)
    const cachedTime = localStorage.getItem(USAGE_TIMESTAMP_KEY)
    const now = Date.now()

    if (!force && cachedData && cachedTime) {
      const age = now - parseInt(cachedTime)
      if (age < CACHE_DURATION) {
        setData(JSON.parse(cachedData))
        setLastUpdated(parseInt(cachedTime))
        return
      }
    }

    setLoading(true)
    try {
      const { data: insights, error } = await supabase.rpc('get_usage_insights', { 
        p_firm_id: firmId 
      })

      if (error) throw error

      if (insights) {
        setData(insights)
        setLastUpdated(now)
        localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify(insights))
        localStorage.setItem(USAGE_TIMESTAMP_KEY, now.toString())
      }
    } catch (err) {
      console.error('Failed to fetch usage insights:', err)
    } finally {
      setLoading(false)
    }
  }, [firmId, supabase])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  return { data, loading, lastUpdated, refresh: () => fetchUsage(true) }
}
