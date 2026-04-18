'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { applyBranding, COLOR_PROFILES } from '@/lib/branding/context'
import { useToast } from '@/lib/hooks/useToast'
import { Btn, Card } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { Palette, Type, Image as ImageIcon } from 'lucide-react'

interface Firm {
  id: string
  name: string
  address: string | null
  phone: string | null
  color_profile: string | null
  font: string | null
}



export default function AdminBrandingPage() {
  const router = useRouter()
  const supabase = createClient()
  const { show } = useToast()
  const { role, firm: currentFirm } = useFirm()

  const [firms, setFirms] = useState<Firm[]>([])
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Allow both superadmin and owner (Firm Admin)
  useEffect(() => {
    if (role && role !== 'superadmin' && role !== 'owner') {
      router.push('/dashboard')
      return
    }
  }, [role, router])

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [colorProfile, setColorProfile] = useState('indigo')
  const [font, setFont] = useState('Noto Sans')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchFirms() {
      setIsLoading(true)
      
      if (role === 'superadmin') {
        const { data, error } = await supabase.from('firms').select('id, name, address, phone, color_profile, font')
        if (!error) setFirms(data as Firm[])
      } else if (currentFirm) {
        // If owner, just set their own firm
        setFirms([currentFirm as any])
        setSelectedFirm(currentFirm as any)
      }
      
      setIsLoading(false)
    }
    fetchFirms()
  }, [show, supabase, role, currentFirm])

  useEffect(() => {
    if (selectedFirm) {
      const { font, color_profile } = selectedFirm
      
      setName(selectedFirm.name || '')
      setAddress(selectedFirm.address || '')
      setPhone(selectedFirm.phone || '')
      setColorProfile(color_profile || 'indigo')
      setFont(font || 'Noto Sans')
      
      applyBranding(font || 'Noto Sans', color_profile || 'indigo')
    } else {
      applyBranding('Noto Sans', 'indigo')
    }
  }, [selectedFirm])

  const handleProfileChange = useCallback((id: string) => {
    setColorProfile(id)
    applyBranding(font, id)
  }, [font]);



  async function saveBranding() {
    if (!selectedFirm) return
    setSaving(true)
    const { error } = await supabase.from('firms').update({
      name: name.trim() || undefined,
      address: address.trim() || null,
      phone: phone.trim() || null,
      color_profile: colorProfile,
      font,
    }).eq('id', selectedFirm.id)
    setSaving(false)
    if (error) {
      show(error.message, 'error')
      return
    }
    show('Identity & Branding saved! ✓')
    
    // Refresh
    if (role === 'superadmin') {
      const { data } = await supabase.from('firms').select('id, name, address, phone, color_profile, font')
      if (data) setFirms(data as Firm[])
    } else {
      // Local refresh for owner
      setSelectedFirm(prev => prev ? { ...prev, name, address, phone, color_profile: colorProfile, font } : null)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold mb-4">Firm Identity & Branding</h1>

      {role === 'superadmin' && (
        <Card className="overflow-hidden">
          <div className="p-5 space-y-5">
            <label htmlFor="firm-select" className="block text-sm font-medium text-gray-700 mb-2">Select a firm to configure:</label>
            <select
              id="firm-select"
              value={selectedFirm?.id || ''}
              onChange={(e) => {
                const firm = firms.find(f => f.id === e.target.value)
                setSelectedFirm(firm || null)
              }}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
              disabled={isLoading}
            >
              <option value="" disabled>-- Select a Firm --</option>
              {firms.map(firm => (
                <option key={firm.id} value={firm.id}>{firm.name}</option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {selectedFirm && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm">
            <Palette size={15} /> Identity & Branding for {selectedFirm.name}
          </div>
          <div className="p-5 space-y-5">

            {/* Firm Identity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5">Firm Name</label>
                <input className={inputClass} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Chits" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5">Firm Address</label>
                <input className={inputClass} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 123 Main St, Chennai" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5">Support Phone</label>
                <input className={inputClass} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} maxLength={10} placeholder="e.g. 9876543210" />
              </div>
            </div>


            {/* Color Profiles */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold uppercase tracking-wide">
                <Palette size={13} /> Color Profile
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {COLOR_PROFILES.map(p => (
                  <button key={p.id} onClick={() => handleProfileChange(p.id)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group"
                    style={{
                      borderColor: colorProfile === p.id ? 'var(--accent)' : 'var(--border)',
                      background: colorProfile === p.id ? 'var(--accent-dim)' : 'var(--surface2)',
                    }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: p.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-tight text-center" 
                      style={{ color: colorProfile === p.id ? 'var(--accent)' : 'var(--text2)' }}>
                      {p.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>


            <div className="flex justify-end pt-2 border-t">
              <Btn variant="primary" loading={saving} onClick={saveBranding}>
                Save Branding & Theme
              </Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
