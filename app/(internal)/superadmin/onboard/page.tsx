'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Mail, Lock, User, MapPin, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import { onboardFirmAction } from '@/app/actions/onboard'

export default function SuperadminOnboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<any>(null)

  const [form, setForm] = useState({
    name: '',
    slug: '',
    city: '',
    ownerEmail: '',
    ownerName: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await onboardFirmAction({
      name: form.name,
      slug: form.slug,
      city: form.city,
      ownerEmail: form.ownerEmail,
      ownerName: form.ownerName,
      initialPassword: form.password || undefined
    })

    if (result.success) {
      setSuccess(result)
    } else {
      setError(result.error || 'Failed to onboard firm')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-6 font-[var(--font-noto)]">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[2rem] p-12 text-center space-y-8 animate-in fade-in zoom-in duration-500">
           <div className="w-20 h-20 bg-success-500/20 text-success-500 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-success-500/5">
              <CheckCircle2 size={40} />
           </div>
           <div className="space-y-4">
              <h1 className="text-3xl font-black tracking-tight">Onboarding Complete</h1>
              <p className="opacity-50 text-sm leading-relaxed">
                 Firm <strong>{form.name}</strong> has been created. The owner <strong>{form.ownerEmail}</strong> can now log in immediately.
              </p>
           </div>
           
           <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left space-y-3 font-mono text-[11px]">
              <div className="flex justify-between border-b border-white/5 pb-2">
                 <span className="opacity-40">LOGIN URL:</span>
                 <span className="text-[var(--accent)] font-bold">chitvault.in/login</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                 <span className="opacity-40">RECOVERY PWD:</span>
                 <span className="font-bold">{form.password || 'Default'}</span>
              </div>
           </div>

           <button 
             onClick={() => window.location.reload()}
             className="w-full py-4 rounded-2xl bg-white text-black font-bold hover:bg-white/90 active:scale-[0.98] transition-all"
           >
             Onboard Another Firm
           </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-[var(--font-noto)]">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-24 space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/10">
           <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--accent)] font-bold text-xs uppercase tracking-[0.2em]">
                 <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> 
                 Control Plane
              </div>
              <h1 className="text-4xl font-black tracking-tight">Firm Onboarding</h1>
              <p className="opacity-50 text-sm">Industrial Deployment & Managed Onboarding</p>
           </div>
           <button 
             onClick={() => router.push('/groups')}
             className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all w-fit"
           >
             <ArrowLeft size={14} /> Back to Dashboard
           </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
           
           {/* Section 1: Firm Identity */}
           <div className="space-y-6">
              <div className="flex items-center gap-3 text-xs font-bold opacity-30 uppercase tracking-widest">
                 <Building2 size={14} /> Organization Details
              </div>
              
              <div className="space-y-4">
                 <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity" size={18} />
                    <input 
                      required
                      placeholder="Organization Name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all placeholder:opacity-20"
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                    />
                 </div>

                 <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 font-bold text-sm">/</div>
                    <input 
                      required
                      placeholder="Subdomain / Slug"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all placeholder:opacity-20 font-mono text-sm"
                      value={form.slug}
                      onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    />
                 </div>

                 <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                    <input 
                      placeholder="Operating City"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all placeholder:opacity-20"
                      value={form.city}
                      onChange={e => setForm({...form, city: e.target.value})}
                    />
                 </div>
              </div>
           </div>

           {/* Section 2: Account Authority */}
           <div className="space-y-6">
              <div className="flex items-center gap-3 text-xs font-bold opacity-30 uppercase tracking-widest">
                 <User size={14} /> Account Authority
              </div>

              <div className="space-y-4">
                 <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                    <input 
                      required
                      placeholder="Owner Full Name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all placeholder:opacity-20"
                      value={form.ownerName}
                      onChange={e => setForm({...form, ownerName: e.target.value})}
                    />
                 </div>

                 <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                    <input 
                      required
                      type="email"
                      placeholder="Registered Email"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all placeholder:opacity-20"
                      value={form.ownerEmail}
                      onChange={e => setForm({...form, ownerEmail: e.target.value})}
                    />
                 </div>

                 <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                    <input 
                      required
                      type="password"
                      placeholder="Initial Access Password"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all placeholder:opacity-20"
                      value={form.password}
                      onChange={e => setForm({...form, password: e.target.value})}
                    />
                 </div>
              </div>
           </div>

           {/* Feedback & Submit */}
           <div className="md:col-span-2 pt-8">
              {error && (
                <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 text-danger-500 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                   <AlertCircle size={20} />
                   <span className="text-sm font-bold">{error}</span>
                </div>
              )}

              <button 
                disabled={loading}
                className="w-full py-5 rounded-[1.5rem] bg-white text-black font-black text-lg hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Authorize Organization'}
              </button>
             
              <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                 <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">Platform Note</div>
                 <p className="text-xs opacity-40 leading-relaxed font-medium">
                    This action creates a new isolated workspace. The owner will be automatically verified and forced password reset can be managed from the Supabase dashboard.
                 </p>
              </div>
           </div>
        </form>

      </div>
    </div>
  )
}
