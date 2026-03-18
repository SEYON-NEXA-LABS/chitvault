'use client'
import { useState, useCallback } from 'react'

type ToastType = 'success' | 'error'

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)

  const show = useCallback((msg: string, type: ToastType = 'success') => {
    setToast({ msg, type })
  }, [])

  const hide = useCallback(() => setToast(null), [])

  return { toast, show, hide }
}
