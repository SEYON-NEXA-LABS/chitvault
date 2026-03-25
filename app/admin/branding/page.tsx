'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { applyBranding, AVAILABLE_FONTS, PRESET_COLORS } from '@/lib/branding/context'
import { useToast } from '@/lib/hooks/useToast'
import { Btn, Card } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { Palette, Type, Image as ImageIcon } from 'lucide-react'

interface Firm {
  id: string
  name: string
  primary_color: string | null
  logo_url: string | null
  tagline: string | null
  font: string | null
}

export default function AdminBrandingPage() {
  const supabase = createClient()
  const { show } = useToast()

  const [firms, setFirms] = useState<Firm[]>([])
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [color, setColor] = useState('#2563eb')
  const [customColor, setCustomColor] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [tagline, setTagline] = useState('Chit Fund Manager')
  const [font, setFont] = useState('DM Sans')
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
      const { name, address, phone, primary_color, logo_url, tagline, font } = selectedFirm as any
      setName(name || '')
      setAddress(address || '')
      setPhone(phone || '')
      setColor(primary_color || '#2563eb')
      setCustomColor(primary_color || '')
      setLogoUrl(logo_url || '')
      setTagline(tagline || 'Chit Fund Manager')
      setFont(font || 'DM Sans')
      applyBranding(primary_color || '#2563eb', font || 'DM Sans')
    } else {
      // Reset to default when no firm is selected
      applyBranding('#2563eb', 'DM Sans')
    }
  }, [selectedFirm])

  const handleColorSelect = useCallback((val: string) => {
    if (val === 'custom') return
    setColor(val); setCustomColor(val)
    applyBranding(val, font) // live preview
  }, [font]);

  const handleCustomColor = useCallback((val: string) => {
    setCustomColor(val)
    setColor(val)
    applyBranding(val, font)
  }, [font]);

  const handleFontChange = useCallback((f: string) => {
    setFont(f)
    applyBranding(color, f)
  }, [color]);

  async function saveBranding() {
    if (!selectedFirm) return
    setSaving(true)
    const { error } = await supabase.from('firms').update({
      name: name.trim() || undefined,
      address: address.trim() || null,
      phone: phone.trim() || null,
      primary_color: color,
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
                  <Image src={logoUrl} alt="Firm logo" width={140} height={44} style={{ borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', background: '#fff', padding: 4 }} />
                )}
                <input className={inputClass} style={inputStyle} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://your-logo.png" />
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5">Tagline</label>
              <input className={inputClass} style={inputStyle} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Trusted Chit Fund Manager" />
            </div>

            {/* Colour */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide">
                <Palette size={13} /> Primary Colour
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_COLORS.map(p => (
                  p.value !== 'custom' ? (
                    <button key={p.value} onClick={() => handleColorSelect(p.value)} title={p.label} style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: 'none', cursor: 'pointer', outline: color === p.value ? `3px solid ${p.value}` : '3px solid transparent', outlineOffset: 2, transition: 'outline 0.15s' }} />
                  ) : null
                ))}
                <div style={{ position: 'relative' }}>
                  <input type="color" value={customColor} onChange={e => handleCustomColor(e.target.value)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 2, background: 'var(--surface2)' }} />
                </div>
              </div>
            </div>

            {/* Font */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide">
                <Type size={13} /> Font
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_FONTS.map(f => (
                  <button key={f.value} onClick={() => handleFontChange(f.value)} className="text-left px-3 py-2.5 rounded-lg border text-sm transition-all" style={{ fontFamily: `'${f.value}', sans-serif`, borderColor: font === f.value ? color : 'var(--border)', background: font === f.value ? `${color}15` : 'var(--surface2)', color: font === f.value ? color : 'var(--text2)', fontWeight: font === f.value ? 700 : 400 }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Btn variant="primary" loading={saving} onClick={saveBranding}>
                Save Branding
              </Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
