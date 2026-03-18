'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * DevToolsPanel — Quick dev user population (dev environment only)
 * Shows buttons to quickly create test accounts without manual entry
 */
export function DevToolsPanel() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Test user credentials (predefined for quick testing)
  const testUsers = [
    { email: 'admin@test.com', password: 'TestPass123!', role: 'Admin (Owner)', color: '#dc2626' },
    { email: 'staff@test.com', password: 'TestPass123!', role: 'Staff', color: '#2563eb' },
    { email: 'manager@test.com', password: 'TestPass123!', role: 'Manager', color: '#059669' },
  ]

  /**
   * Copy auth user UUID to clipboard
   * (User creates auth user manually, then copies UUID from Supabase Dashboard)
   */
  const copyCreationSteps = () => {
    const steps = `ChitVault Dev Setup:

1. Copy this email
2. Go to Supabase Dashboard > Authentication > Users
3. Click "Add user"
4. Paste email: ${testUsers[0].email}
5. Set password: ${testUsers[0].password}
6. Confirm and note the UUID
7. Go to SQL Editor, update seed_dev_users.sql:
   - Replace aaaaaaaa... with the UUID
8. Run seed_dev_users.sql
9. Then sign in with these credentials below`

    navigator.clipboard.writeText(steps)
    setMessage('Setup steps copied to clipboard!')
    setTimeout(() => setMessage(''), 3000)
  }

  /**
   * Copy test user credentials to clipboard
   */
  const copyTestUserCredentials = (email: string, password: string) => {
    const creds = `Email: ${email}\nPassword: ${password}`
    navigator.clipboard.writeText(creds)
    setMessage(`Credentials copied! Email: ${email}`)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9999,
      background: '#1f2937',
      border: '1px solid #374151',
      borderRadius: 12,
      padding: 16,
      maxWidth: 320,
      boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
      color: '#f3f4f6',
      fontSize: 12,
      fontFamily: 'monospace'
    }}>
      {/* Header */}
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 12,
        color: '#fbbf24',
        textTransform: 'uppercase',
        letterSpacing: 1
      }}>
        🛠️ Dev Tools (Testing Only)
      </div>

      {/* Messages */}
      {message && (
        <div style={{
          padding: 8,
          background: '#10b981',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 11,
          color: '#fff'
        }}>
          ✓ {message}
        </div>
      )}
      {error && (
        <div style={{
          padding: 8,
          background: '#ef4444',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 11,
          color: '#fff'
        }}>
          ✗ {error}
        </div>
      )}

      {/* Test User Buttons */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#d1d5db' }}>
          Test User Credentials:
        </div>
        {testUsers.map((user) => (
          <button
            key={user.email}
            onClick={() => copyTestUserCredentials(user.email, user.password)}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 10px',
              marginBottom: 6,
              background: user.color,
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              opacity: 0.9,
              textAlign: 'left'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.9')}
          >
            Copy {user.role} ({user.email})
          </button>
        ))}
      </div>

      {/* Setup Guide Button */}
      <button
        onClick={copyCreationSteps}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: '#6366f1',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.2s',
          opacity: 0.9,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.9')}
      >
        📋 Copy Setup Steps
      </button>

      {/* Info */}
      <div style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: '1px solid #4b5563',
        fontSize: 10,
        color: '#9ca3af',
        lineHeight: 1.5
      }}>
        <p style={{ margin: '0 0 6px 0' }}>
          <strong>Seed data:</strong> Firms, groups, members, payments, auctions loaded
        </p>
        <p style={{ margin: '0 0 6px 0' }}>
          <strong>Next:</strong> Create auth users manually in Supabase Dashboard
        </p>
        <p style={{ margin: 0 }}>
          <strong>Then:</strong> Copy credentials above and sign in
        </p>
      </div>
    </div>
  )
}
