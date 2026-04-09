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
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-6 font-[var(--font-noto)]">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        
        {/* Progress header */}
        <div className="flex items-center justify-between mb-8 px-2">
           <div className="flex gap-2">
             {steps.map((_, i) => (
               <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-white/10'}`} />
             ))}
           </div>
           <span className="text-[10px] font-black uppercase tracking-widest opacity-30">{step + 1} / {steps.length}</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 md:p-12 space-y-8 backdrop-blur-xl relative overflow-hidden group">
          {/* Subtle glow effect */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-[var(--accent)]/10 blur-[80px] rounded-full" />
          
          <div className="relative space-y-6 text-center">
            <div className="text-6xl mb-6 transform transition-transform group-hover:scale-110 duration-500 inline-block">{current.icon}</div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black tracking-tight leading-tight">
                {current.title}
              </h2>
              <p className="text-sm opacity-50 leading-relaxed font-medium">
                {current.body}
              </p>
            </div>
          </div>

          {/* Trial info on first step */}
          {step === 0 && firm && (
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4 animate-in slide-in-from-bottom-4 duration-700">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Subscription Instance</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                   <span className="opacity-40">Firm Name</span>
                   <span className="font-bold">{firm.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                   <span className="opacity-40">Plan Status</span>
                   <span className="text-success-500 font-bold uppercase tracking-wider">Active Trial</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-4">
            <button 
              onClick={next}
              className="w-full py-5 rounded-[1.5rem] bg-white text-black font-black text-lg hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl shadow-white/5"
            >
              {current.action}
            </button>

            {step > 0 && (
              <button 
                onClick={() => setStep(s => s - 1)}
                className="w-full text-xs font-bold opacity-30 hover:opacity-100 transition-opacity tracking-widest uppercase"
              >
                Go Back
              </button>
            )}
          </div>
        </div>

        <button 
          onClick={() => window.location.replace('/dashboard')}
          className="w-full mt-10 text-[10px] font-bold uppercase tracking-[0.3em] opacity-20 hover:opacity-100 transition-opacity"
        >
          Skip Intro Sequence →
        </button>

      </div>
    </div>
  )
}
