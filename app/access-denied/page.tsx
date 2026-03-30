'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, ShieldAlert } from 'lucide-react'

export default function AccessDeniedPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 20, 
      background: '#0d0f14' 
    }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ 
          width: 80, 
          height: 80, 
          borderRadius: 40, 
          background: 'rgba(239, 68, 68, 0.1)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 24px',
          color: '#ef4444'
        }}>
          <ShieldAlert size={40} />
        </div>
        
        <h1 style={{ 
          fontSize: 28, 
          fontWeight: 800, 
          color: '#e8ecf5', 
          marginBottom: 16,
          letterSpacing: '-0.02em'
        }}>
          Access Revoked
        </h1>
        
        <p style={{ 
          fontSize: 15, 
          color: '#8892aa', 
          lineHeight: 1.7, 
          marginBottom: 32 
        }}>
          Your account access for this firm has been disabled by the administrator. 
          If you believe this is an error, please contact your manager.
        </p>

        <button 
          onClick={handleSignOut}
          style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px', 
            background: '#161921', 
            color: '#e8ecf5', 
            border: '1px solid #2a3045', 
            borderRadius: 12, 
            fontSize: 14, 
            fontWeight: 600, 
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <LogOut size={16} />
          Sign Out of System
        </button>
      </div>
    </div>
  )
}
