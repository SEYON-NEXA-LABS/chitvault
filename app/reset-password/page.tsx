'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Btn } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)

  useEffect(() => {
    // Check if the user is authenticated (which happens automatically via the email recovery link)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setIsValidSession(true)
    }
    checkSession()
    
    // Also listen for auth state changes just in case it loads slowly
    const { data: authListener } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setIsValidSession(true)
      }
    })
    
    // Enforce light theme globally as requested
    document.documentElement.classList.remove('dark')

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [supabase.auth])

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    
    if (error) {
      setError(error.message)
      return
    }
    
    setSuccess('Password updated successfully! Redirecting...')
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  }

  const sty = {
    page: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)'
    } as React.CSSProperties,
    card: {
      width: '100%', maxWidth: 400, background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 18,
      padding: 32, boxShadow: 'var(--shadow)'
    } as React.CSSProperties,
    lbl: { fontSize: 11, fontWeight: 600 as const, color: 'var(--text2)',textTransform: 'uppercase' as const, letterSpacing: 1, display: 'block', marginBottom: 4 },
  }

  return (
    <div style={sty.page}>
      <div style={sty.card}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Reset Password</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Enter your new secure password below</div>
        </div>

        {error && <div style={{ padding: '12px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ padding: '12px 14px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, color: '#16a34a', fontSize: 13, marginBottom: 16 }}>{success}</div>}

        {!isValidSession && !success && !error && (
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', marginBottom: 20 }}>
            Waiting for secure session verification...<br/><br/>
            If you did not use a valid link from your email, this page will not work.
          </div>
        )}

        {isValidSession && !success && (
          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={sty.lbl}>New Password</label>
              <input className={inputClass} style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required />
            </div>
            <div>
              <label style={sty.lbl}>Confirm New Password</label>
              <input className={inputClass} style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Retype password" required />
            </div>
            
            <Btn variant="primary" loading={loading} style={{ marginTop: 10, width: '100%', padding: '12px 0' }}>
              Update Password
            </Btn>
          </form>
        )}
        
        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <a href="/login" style={{ fontSize: 13, color: 'var(--blue)', textDecoration: 'none', fontWeight: 600 }}>
            Back to Login
          </a>
        </div>
      </div>
    </div>
  )
}
