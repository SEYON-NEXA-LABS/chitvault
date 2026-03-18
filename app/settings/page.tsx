'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { applyBranding, AVAILABLE_FONTS, PRESET_COLORS } from '@/lib/branding/context'
import { Btn, Card, Badge, Toast } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { APP_NAME, fmt } from '@/lib/utils'
import { Sun, Moon, LogOut, Key, Database, Palette, Type, Image, Link } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const { firm, refresh, can } = useFirm()
  const { toast, show, hide } = useToast()

  const [email,     setEmail]     = useState('')
  const [theme,     setTheme]     = useState<'dark'|'light'>('dark')
  const [resetting, setResetting] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [resetMsg,  setResetMsg]  = useState('')

  // Branding form state
  const [color,      setColor]      = useState(firm?.primary_color || '#c9a84c')
  const [customColor, setCustomColor] = useState(firm?.primary_color || '#c9a84c')
  const [logoUrl,    setLogoUrl]    = useState(firm?.logo_url || '')
  const [tagline,    setTagline]    = useState(firm?.tagline || 'Chit Fund Manager')
  const [font,       setFont]       = useState(firm?.font || 'DM Sans')
  const [regToken,   setRegToken]   = useState(firm?.register_token || '')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
    const t = (localStorage.getItem('theme') || 'dark') as 'dark'|'light'
    setTheme(t)
    if (firm) {
      setColor(firm.primary_color || '#c9a84c')
      setCustomColor(firm.primary_color || '#c9a84c')
      setLogoUrl(firm.logo_url || '')
      setTagline(firm.tagline || 'Chit Fund Manager')
      setFont(firm.font || 'DM Sans')
      setRegToken(firm.register_token || '')
    }
  }, [firm])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
  }

  function handleColorSelect(val: string) {
    if (val === 'custom') return
    setColor(val); setCustomColor(val)
    applyBranding(val, font) // live preview
  }

  function handleCustomColor(val: string) {
    setCustomColor(val); setColor(val)
    applyBranding(val, font)
  }

  function handleFontChange(f: string) {
    setFont(f)
    applyBranding(color, f) // live preview
  }

  async function saveBranding() {
    if (!firm) return
    setSaving(true)
    const { error } = await supabase.from('firms').update({
      primary_color: color,
      logo_url:      logoUrl.trim() || null,
      tagline:       tagline.trim() || 'Chit Fund Manager',
      font,
    }).eq('id', firm.id)
    setSaving(false)
    if (error) { show(error.message, 'error'); return }
    show('Branding saved! ✓')
    refresh()
  }

  async function generateRegToken() {
    if (!firm) return
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 20)
    await supabase.from('firms').update({ register_token: token }).eq('id', firm.id)
    setRegToken(token)
    show('Registration link generated!')
    refresh()
  }

  async function revokeRegToken() {
    if (!firm || !confirm('Revoke this registration link? Existing staff won\'t be affected.')) return
    await supabase.from('firms').update({ register_token: null }).eq('id', firm.id)
    setRegToken('')
    show('Link revoked.')
    refresh()
  }

  const regLink = regToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?token=${regToken}` : null

  return (
    <div className="max-w-2xl space-y-4">

      {/* ── Branding ─────────────────────────────────────── */}
      {can('viewSettings') && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Palette size={15} /> Branding & Appearance
          </div>
          <div className="p-5 space-y-5">

            {/* Logo */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                <Image size={13} /> Logo URL
              </div>
              <div className="flex gap-3 items-center">
                {logoUrl && (
                  <img src={logoUrl} alt="logo preview"
                    style={{ height: 44, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', background: '#fff', padding: 4 }} />
                )}
                <input className={inputClass} style={inputStyle} value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://your-logo.png (leave blank for emoji icon)" />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text3)' }}>
                Host your logo on imgur.com or your website. Recommended: 200×60px PNG/SVG with transparent background.
              </p>
            </div>

            {/* Tagline */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>
                Tagline (shown below business name on login)
              </label>
              <input className={inputClass} style={inputStyle} value={tagline}
                onChange={e => setTagline(e.target.value)} placeholder="e.g. Trusted Chit Fund Manager" />
            </div>

            {/* Colour */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                <Palette size={13} /> Primary Colour
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_COLORS.map(p => (
                  p.value !== 'custom' ? (
                    <button key={p.value} onClick={() => handleColorSelect(p.value)}
                      title={p.label}
                      style={{
                        width: 32, height: 32, borderRadius: 8, background: p.value, border: 'none', cursor: 'pointer',
                        outline: color === p.value ? `3px solid ${p.value}` : '3px solid transparent',
                        outlineOffset: 2, transition: 'outline 0.15s'
                      }} />
                  ) : null
                ))}
                {/* Custom colour picker */}
                <div style={{ position: 'relative' }}>
                  <input type="color" value={customColor} onChange={e => handleCustomColor(e.target.value)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 2, background: 'var(--surface2)' }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ width: 24, height: 24, borderRadius: 6, background: color }} />
                <span className="text-sm font-mono" style={{ color: 'var(--text2)' }}>{color}</span>
                <span className="text-xs" style={{ color: 'var(--text3)' }}>— Live preview active</span>
              </div>
            </div>

            {/* Font */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                <Type size={13} /> Font
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_FONTS.map(f => (
                  <button key={f.value} onClick={() => handleFontChange(f.value)}
                    className="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
                    style={{
                      fontFamily: `'${f.value}', sans-serif`,
                      borderColor: font === f.value ? color : 'var(--border)',
                      background: font === f.value ? `${color}15` : 'var(--surface2)',
                      color: font === f.value ? color : 'var(--text2)',
                      fontWeight: font === f.value ? 700 : 400,
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="primary" loading={saving} onClick={saveBranding}>
                Save Branding
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* ── Registration Link ─────────────────────────────── */}
      {can('viewSettings') && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Link size={15} /> Private Registration Link
          </div>
          <div className="p-5">
            <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
              Share this link with new staff. They can create an account and automatically join your firm. Revoke it anytime.
            </p>
            {regLink ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input className={inputClass} style={{ ...inputStyle, fontSize: 12, fontFamily: 'monospace' }}
                    value={regLink} readOnly />
                  <Btn variant="secondary" onClick={() => { navigator.clipboard.writeText(regLink); show('Link copied!') }}>
                    Copy
                  </Btn>
                </div>
                <div className="flex gap-2">
                  <Btn variant="secondary" size="sm" onClick={() => {
                    if (navigator.share) navigator.share({ title: `Join ${firm?.name}`, url: regLink })
                    else { navigator.clipboard.writeText(regLink); show('Link copied — share via WhatsApp') }
                  }}>Share via WhatsApp</Btn>
                  <Btn variant="danger" size="sm" onClick={revokeRegToken}>Revoke Link</Btn>
                </div>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>
                  ⚠ Anyone with this link can register as staff in your firm. Revoke if shared accidentally.
                </p>
              </div>
            ) : (
              <Btn variant="primary" onClick={generateRegToken}>Generate Registration Link</Btn>
            )}
          </div>
        </Card>
      )}

      {/* ── Account ───────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          👤 Account
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between py-2 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text2)' }}>Email</span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{email}</span>
          </div>
          <div className="flex justify-between py-2 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text2)' }}>Authentication</span>
            <Badge variant="green">Supabase Auth ✓</Badge>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Btn variant="secondary" loading={resetting} onClick={async () => {
              setResetting(true)
              const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/dashboard` })
              setResetting(false)
              setResetMsg(error ? '✗ ' + error.message : '✓ Reset link sent to ' + email)
            }}>
              <Key size={14} /> Send Password Reset
            </Btn>
            <Btn variant="danger" onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}>
              <LogOut size={14} /> Sign Out
            </Btn>
          </div>
          {resetMsg && <p className="text-sm" style={{ color: resetMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{resetMsg}</p>}
        </div>
      </Card>

      {/* ── Appearance ────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          🌗 Theme
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Dark / Light Mode</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text2)' }}>Currently: <strong>{theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'}</strong></div>
          </div>
          <Btn variant="secondary" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={14}/> : <Moon size={14}/>} Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </Btn>
        </div>
      </Card>

      {/* ── App Info ──────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          ℹ️ App Info
        </div>
        <div className="p-5 space-y-0">
          {[
            ['Business',   firm?.name || '—'],
            ['Plan',       firm?.plan ? firm.plan.charAt(0).toUpperCase() + firm.plan.slice(1) : '—'],
            ['Version',    process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0'],
            ['Framework',  'Next.js 14 + Supabase'],
            ['DB',         process.env.NEXT_PUBLIC_SUPABASE_URL || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5 border-b last:border-0 text-sm"
              style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text2)' }}>{k}</span>
              <span className="font-medium text-xs font-mono truncate max-w-xs" style={{ color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
