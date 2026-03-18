'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEV_USERS = [
  { role: 'Admin', email: 'admin@dev.chitvault.local', password: 'Dev@123456' },
  { role: 'Staff', email: 'staff@dev.chitvault.local', password: 'Dev@123456' },
  { role: 'Manager', email: 'manager@dev.chitvault.local', password: 'Dev@123456' }
]

// Dev firm UUID from seed_dev_firm.sql
const DEV_FIRM_ID = '7e92aa8b-ca5e-4e70-af7d-a4d166ba9a2c'

export function DevCredentials() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  async function handleDevLogin(email: string, password: string) {
    setError('')
    setLoading(email)

    try {
      // 1. Sign in
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        setError(`Login failed: ${authError.message}`)
        setLoading(null)
        return
      }

      if (!data.session) {
        setError('No session. User may not exist in auth.')
        setLoading(null)
        return
      }

      // 2. Hard navigate to dashboard to ensure middleware runs
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(`Error: ${err.message}`)
      setLoading(null)
    }
  }

  return (
    <div style={{
      marginTop: 24,
      paddingTop: 20,
      borderTop: '1px solid var(--border)',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text2)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        opacity: 0.7
      }}>
        Dev Quick Login
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        {DEV_USERS.map((user) => (
          <button
            key={user.email}
            onClick={() => handleDevLogin(user.email, user.password)}
            disabled={loading !== null}
            style={{
              padding: '9px 14px',
              background: loading === user.email ? 'var(--primary)' : 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading === user.email ? 'not-allowed' : 'pointer',
              opacity: loading === user.email ? 0.7 : 1,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (loading === null) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (loading === null) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
              }
            }}
          >
            {loading === user.email ? '🔄 Signing in...' : `📌 ${user.role}`}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          marginTop: 12,
          padding: 10,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgb(239, 68, 68)',
          borderRadius: 6,
          color: 'rgb(239, 68, 68)',
          fontSize: 12
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
