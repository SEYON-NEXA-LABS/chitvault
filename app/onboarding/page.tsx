'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Firm } from '@/types'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [firm, setFirm] = useState<Firm | null>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('firm_id').eq('id', user.id).maybeSingle()
      if (!profile?.firm_id) { router.push('/register'); return }
      const { data: f } = await supabase.from('firms').select('*').eq('id', profile.firm_id).maybeSingle()
      setFirm(f)
    }
    load()
  }, [router, supabase])

  const steps = [
    {
      icon: '🎉',
      title: `Welcome to Seyon Chit Vault!`,
      body: `Your account for ${firm?.name || 'your business'} is ready. You have a 30-day free trial to explore everything.`,
      action: 'Get Started →'
    },
    {
      icon: '🏦',
      title: 'Create Your First Chit Group',
      body: 'Go to "Chit Groups" and click "+ New Group". Enter the chit value, number of members, duration and monthly contribution.',
      action: 'Next →'
    },
    {
      icon: '👥',
      title: 'Add Members',
      body: 'Go to "Members" and add your chit fund members with their names, phone numbers and ticket numbers.',
      action: 'Next →'
    },
    {
      icon: '🔨',
      title: 'Record Monthly Auctions',
      body: 'After each auction, go to "Auctions" and record the winner and bid amount. ChitVault auto-calculates dividends.',
      action: 'Next →'
    },
    {
      icon: '💳',
      title: 'Track Payments',
      body: 'Use the Payment Matrix to see who has paid and who hasn\'t. Generate a Collection Report for your field staff.',
      action: 'Go to Dashboard →'
    },
  ]

  function next() {
    if (step < steps.length - 1) setStep(s => s + 1)
    else window.location.replace('/dashboard')
  }

  const current = steps[step]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0d0f14' }}>
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i <= step ? '#2563eb' : '#2a3045', transition: 'all 0.3s' }} />
          ))}
        </div>

        <div style={{ background: '#161921', border: '1px solid #2a3045', borderRadius: 20, padding: '40px 36px' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>{current.icon}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 14, color: '#e8ecf5' }}>
            {current.title}
          </h2>
          <p style={{ fontSize: 15, color: '#8892aa', lineHeight: 1.7, marginBottom: 32 }}>
            {current.body}
          </p>

          {/* Trial info on first step */}
          {step === 0 && firm && (
            <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, marginBottom: 8 }}>Your Account Details</div>
              <div style={{ fontSize: 13, color: '#8892aa', lineHeight: 2 }}>
                <div>Business: <strong style={{ color: '#e8ecf5' }}>{firm.name}</strong></div>
                <div>Plan: <strong style={{ color: '#e8ecf5' }}>Trial (30 days free)</strong></div>
                <div>Login URL: <strong style={{ color: '#2563eb' }}>chitvault.app/login</strong></div>
              </div>
            </div>
          )}

          <button onClick={next}
            style={{ width: '100%', padding: '14px 0', background: '#2563eb', color: '#0d0f14', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            {current.action}
          </button>

          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ width: '100%', marginTop: 10, padding: '10px 0', background: 'transparent', color: '#505a70', border: 'none', fontSize: 14, cursor: 'pointer' }}>
              ← Back
            </button>
          )}
        </div>

        <button onClick={() => window.location.replace('/dashboard')}
          style={{ marginTop: 16, background: 'none', border: 'none', color: '#505a70', fontSize: 13, cursor: 'pointer' }}>
          Skip intro →
        </button>

      </div>
    </div>
  )
}
