'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'
import { useToast } from '@/lib/hooks/useToast'
import { Btn, Card } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { Palette, Type, Image as ImageIcon } from 'lucide-react'
import { THEMES, getTheme } from '@/lib/branding/themes'

interface Firm {
  id: string
  name: string
  primary_color: string | null
  accent_color: string | null
  theme_id: string | null
  logo_url: string | null
  tagline: string | null
  font: string | null
}

const AVAILABLE_FONTS = [
  { label: 'Noto Sans (Best Support)', value: 'Noto Sans' },
  { label: 'Mukta Malar',             value: 'Mukta Malar' },
  { label: 'Hind Madurai',            value: 'Hind Madurai' },
]

export default function AdminBrandingPage() {
  const supabase = createClient()
  const { show } = useToast()

  const [firms, setFirms] = useState<Firm[]>([])
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [themeId, setThemeId] = useState('theme1')
  const [logoUrl, setLogoUrl] = useState('')
  const [tagline, setTagline] = useState('Chit Fund Manager')
  const [font, setFont] = useState('Noto Sans')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchFirms() {
      setIsLoading(true)
      const { data, error } = await supabase.from('firms').select('*')
      if (error) {
        show(error.message, 'error')
      } else {
        setFirms(data as Firm[])
      }
      setIsLoading(false)
    }
    fetchFirms()
  }, [show, supabase])

  useEffect(() => {
    if (selectedFirm) {
      const { name, address, phone, theme_id, logo_url, tagline, font, primary_color, accent_color } = selectedFirm as any
      const theme = getTheme(theme_id)
      
      setName(name || '')
      setAddress(address || '')
      setPhone(phone || '')
      setThemeId(theme_id || 'theme1')
      setLogoUrl(logo_url || '')
      setTagline(tagline || 'Chit Fund Manager')
      setFont(font || 'Noto Sans')
      
      applyBranding(
        primary_color || theme.primary, 
        font || 'Noto Sans', 
        accent_color || theme.accent,
        theme.bg
      )
    } else {
      const def = getTheme('theme1')
      applyBranding(def.primary, 'Noto Sans', def.accent, def.bg)
    }
  }, [selectedFirm])

  const handleThemeChange = useCallback((id: string) => {
    setThemeId(id)
    const t = getTheme(id)
    applyBranding(t.primary, font, t.accent, t.bg) // live preview
  }, [font]);

  const handleFontChange = useCallback((f: string) => {
    setFont(f)
    const t = getTheme(themeId)
    applyBranding(t.primary, f, t.accent, t.bg)
  }, [themeId]);

  async function saveBranding() {
    if (!selectedFirm) return
    setSaving(true)
    const { error } = await supabase.from('firms').update({
      name: name.trim() || undefined,
      address: address.trim() || null,
      phone: phone.trim() || null,
      theme_id: themeId,
      // Clear legacy custom colors when theme is set
      primary_color: null,
      accent_color: null,
      logo_url: logoUrl.trim() || null,
      tagline: tagline.trim() || 'Chit Fund Manager',
      font,
    }).eq('id', selectedFirm.id)
    setSaving(false)
    if (error) {
      show(error.message, 'error')
      return
    }
    show('Identity & Branding saved! ✓')
    // Refresh the firms list to get the updated data
    const { data, error: fetchError } = await supabase.from('firms').select('*')
    if (!fetchError) {
      setFirms(data as Firm[])
       const updatedFirm = (data as Firm[]).find(f => f.id === selectedFirm.id)
       if (updatedFirm) setSelectedFirm(updatedFirm)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold mb-4">Branding & Appearance</h1>

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

            {/* Logo */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide">
                <ImageIcon size={13} /> Logo URL
              </div>
              <div className="flex gap-3 items-center">
                {logoUrl && (
                  <div className="relative w-32 h-12 bg-white rounded-lg border p-1 border-gray-100 flex items-center justify-center overflow-hidden">
                     <img src={logoUrl} alt="Firm logo" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                <input className={inputClass} style={inputStyle} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://your-logo.png" />
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5">Tagline</label>
              <input className={inputClass} style={inputStyle} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Trusted Chit Fund Manager" />
            </div>

            {/* Theme Selection */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide">
                <Palette size={13} /> Select Predefined Theme
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {THEMES.map(t => (
                  <button key={t.id} 
                    onClick={() => handleThemeChange(t.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${themeId === t.id ? 'border-blue-500 shadow-sm' : 'border-gray-100'}`}
                    style={{ background: t.bg }}>
                    <div className="text-[10px] font-bold text-gray-800 mb-2 truncate">{t.name}</div>
                    <div className="flex gap-1.5">
                      <div className="w-5 h-5 rounded-md" style={{ background: t.primary }} />
                      <div className="w-5 h-5 rounded-md" style={{ background: t.accent }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Font */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide">
                <Type size={13} /> Font
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_FONTS.map(f => (
                  <button key={f.value} onClick={() => handleFontChange(f.value)} className="text-left px-3 py-2.5 rounded-lg border text-sm transition-all" style={{ fontFamily: `'${f.value}', sans-serif`, borderColor: font === f.value ? 'var(--blue)' : 'var(--border)', background: font === f.value ? 'var(--blue-dim)' : 'var(--surface2)', color: font === f.value ? 'var(--blue)' : 'var(--text2)', fontWeight: font === f.value ? 700 : 400 }}>
                    {f.label}
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
