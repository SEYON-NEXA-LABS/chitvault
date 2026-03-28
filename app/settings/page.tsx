'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { applyBranding, AVAILABLE_FONTS, PRESET_COLORS } from '@/lib/branding/context'
import { Btn, Card, Badge, Toast } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { APP_NAME } from '@/lib/utils'
import { 
  Sun, Moon, LogOut, Key, Palette, Type, Building, Building2, 
  Smartphone, MapPin, Link, Trash2, Image as ImageIcon, ShieldCheck, User,
  Lock, LockKeyhole
} from 'lucide-react'
import { usePinLock } from '@/lib/lock/context'
import Image from 'next/image'

export default function SettingsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const { profile, role, firm, can, refresh } = useFirm()
  const { toast, show, hide } = useToast()
  const { isElectron, hasPin, setPin, lock } = usePinLock()

  const isSuperAdmin = role === 'superadmin'

  const [email,     setEmail]     = useState('')
  const [theme,     setTheme]     = useState<'dark'|'light'>('light')
  const [resetting, setResetting] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [resetMsg,  setResetMsg]  = useState('')

  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passMsg,     setPassMsg]     = useState<{text:string, type:'success'|'error'}|null>(null)

  const [pinInput,   setPinInput]   = useState('')
  const [pinChange,  setPinChange]  = useState(false)

  // Branding form state
  const [name,       setName]       = useState(firm?.name || '')
  const [address,    setAddress]    = useState(firm?.address || '')
  const [phone,      setPhone]      = useState(firm?.phone || '')
  const [color,      setColor]      = useState(firm?.primary_color || '#2563eb')
  const [accentColor, setAccentColor] = useState(firm?.accent_color || '#1e40af')
  const [customColor, setCustomColor] = useState(firm?.primary_color || '#2563eb')
  const [logoUrl,    setLogoUrl]    = useState(firm?.logo_url || '')
  const [tagline,    setTagline]    = useState(firm?.tagline || 'Chit Fund Manager')
  const [font,       setFont]       = useState(firm?.font || 'Noto Sans')
  const [regToken,   setRegToken]   = useState(firm?.register_token || '')

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      setEmail(data.user?.email || '')
    }
    loadUser()
    const t = (localStorage.getItem('theme') || 'light') as 'dark'|'light'
    setTheme(t)
    if (firm) {
      setName(firm.name || '')
      setAddress(firm.address || '')
      setPhone(firm.phone || '')
      setColor(firm.primary_color || '#2563eb')
      setAccentColor(firm.accent_color || '#1e40af')
      setCustomColor(firm.primary_color || '#2563eb')
      setLogoUrl(firm.logo_url || '')
      setTagline(firm.tagline || 'Chit Fund Manager')
      setFont(firm.font || 'Noto Sans')
      setRegToken(firm.register_token || '')
    }
  }, [firm, supabase.auth])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  function handleColorSelect(val: string) {
    if (val === 'custom') return
    setColor(val); setCustomColor(val)
    applyBranding(val, font, accentColor)
  }

  function handleCustomColor(val: string) {
    setCustomColor(val); setColor(val)
    applyBranding(val, font, accentColor)
  }

  function handleAccentChange(val: string) {
    setAccentColor(val)
    applyBranding(color, font, val)
  }

  function handleFontChange(f: string) {
    setFont(f)
    applyBranding(color, f, accentColor)
  }

  async function saveBranding() {
    if (!firm) return
    setSaving(true)
    const { error } = await supabase.from('firms').update({
      name:          name.trim() || undefined,
      address:       address.trim() || null,
      phone:         phone.trim() || null,
      primary_color: color,
      accent_color:  accentColor,
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

  async function updatePassword() {
    setPassMsg(null)
    if (!newPass) return
    if (newPass.length < 6) { setPassMsg({ text: 'Password must be at least 6 characters.', type: 'error' }); return }
    if (newPass !== confirmPass) { setPassMsg({ text: 'Passwords do not match.', type: 'error' }); return }
    
    setPassLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setPassLoading(false)
    
    if (error) { setPassMsg({ text: error.message, type: 'error' }); return }
    
    setPassMsg({ text: 'Password updated successfully! ✓', type: 'success' })
    setNewPass(''); setConfirmPass('')
  }

  const regLink = regToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?token=${regToken}` : null

  return (
    <div className="max-w-2xl space-y-4">

      {/* ── Firm Profile (Basic Info for Admin/Owner) ────────────────── */}
      {can('viewSettings') && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Building size={15} /> Firm Profile
          </div>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>Firm Name</label>
                <input className={inputClass} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Chits" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>Firm Address</label>
                <input className={inputClass} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 123 Main St, Chennai" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>Support Phone</label>
                <input className={inputClass} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} maxLength={10} pattern={"[0-9]{10}"} placeholder="e.g. 9876543210" />
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="primary" loading={saving} onClick={saveBranding}>
                Save Changes
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* ── Branding (Superadmin Only) ─────────────────────────────────── */}
      {can('viewSettings') && isSuperAdmin && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Palette size={15} /> Branding & Appearance
          </div>
          <div className="p-5 space-y-5">

            {/* Logo */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                <ImageIcon size={13} /> Logo URL
              </div>
              <div className="flex gap-3 items-center">
                {logoUrl && (
                  <Image src={logoUrl} alt="logo preview" width={176} height={44}
                    style={{ borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', background: '#fff', padding: 4 }} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              {/* Primary */}
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
                  <div style={{ position: 'relative' }}>
                    <input type="color" value={customColor} onChange={e => handleCustomColor(e.target.value)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 2, background: 'var(--surface2)' }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: color }} />
                  <span className="text-xs font-mono opacity-60">{color}</span>
                </div>
              </div>

              {/* Accent */}
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                  <Palette size={13} /> Accent Colour
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['#1e40af', '#1d4ed8', '#0369a1', '#0e7490', '#c026d3', '#db2777', '#dc2626', '#d97706'].map(c => (
                    <button key={c} onClick={() => handleAccentChange(c)}
                      title="Preset"
                      style={{
                        width: 32, height: 32, borderRadius: 8, background: c, border: 'none', cursor: 'pointer',
                        outline: accentColor === c ? `3px solid ${c}` : '3px solid transparent',
                        outlineOffset: 2, transition: 'outline 0.15s'
                      }} />
                  ))}
                  <div style={{ position: 'relative' }}>
                    <input type="color" value={accentColor} onChange={e => handleAccentChange(e.target.value)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 2, background: 'var(--surface2)' }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: accentColor }} />
                  <span className="text-xs font-mono opacity-60">{accentColor}</span>
                </div>
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

      {/* ── Registration Link (Superadmin Only) ─────────────────────────── */}
      {can('viewSettings') && isSuperAdmin && (
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

      {/* ── Account Security ───────────────────────────────────── */}
      <Card title="👤 Account Settings" subtitle="Update your password and manage your session">
        <div className="p-5 space-y-6">
          
          {/* Profile info */}
          <div className="space-y-3">
            <div className="flex justify-between py-2.5 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
              <span className="opacity-60">Email Address</span>
              <span className="font-semibold">{email}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
              <span className="opacity-60">Status</span>
              <Badge variant="green">Active Account ✓</Badge>
            </div>
          </div>

          {/* Direct Password Update */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50">
              <Key size={12} /> Change Password
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>New Password</label>
                <input className={inputClass} style={inputStyle} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Minimum 6 chars" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>Confirm Password</label>
                <input className={inputClass} style={inputStyle} type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Retype password" />
              </div>
            </div>

            {passMsg && (
              <p className="text-sm font-medium" style={{ color: passMsg.type === 'success' ? 'var(--green)' : 'var(--red)' }}>
                {passMsg.type === 'success' ? '✓ ' : '✗ '}{passMsg.text}
              </p>
            )}

            <Btn variant="primary" loading={passLoading} onClick={updatePassword} size="sm" disabled={!newPass}>
              Update Password
            </Btn>
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />

          {/* App PIN Lock (Web & Desktop) */}
          <hr style={{ borderColor: 'var(--border)' }} />
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50">
              <Lock size={12} /> App PIN Lock
            </div>
            
            <div className="flex items-center justify-between bg-[var(--surface2)] p-4 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-sm font-semibold">Requirement PIN on Startup</div>
                <p className="text-xs opacity-60">Secure your session with a 4-6 digit code.</p>
              </div>
              <div className="flex items-center gap-2">
                {hasPin ? (
                  <Badge variant="green">Enabled ✓</Badge>
                ) : (
                  <Badge variant="gray">Disabled</Badge>
                )}
              </div>
            </div>

            {!pinChange && hasPin && (
              <div className="flex gap-2">
                <Btn variant="secondary" size="sm" onClick={() => setPinChange(true)}>Change PIN</Btn>
                <Btn variant="secondary" size="sm" onClick={() => { setPin(null); show('PIN Disabled') }}>Disable PIN</Btn>
                <Btn variant="primary" size="sm" onClick={lock}>Lock Now</Btn>
              </div>
            )}

            {(pinChange || !hasPin) && (
              <div className="space-y-3 p-4 bg-gold/5 rounded-xl border border-gold/20">
                <label className="text-xs font-bold text-gold uppercase tracking-wider block">Set New 4-6 Digit PIN</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    maxLength={6} 
                    className={inputClass} 
                    style={{ ...inputStyle, width: 120, letterSpacing: 8, textAlign: 'center' }} 
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value.replace(/\D/g,''))}
                    placeholder="••••••"
                  />
                  <Btn variant="primary" size="sm" disabled={pinInput.length < 4} onClick={() => {
                    setPin(pinInput)
                    setPinInput('')
                    setPinChange(false)
                    show('PIN Saved Successfully!')
                  }}>Save PIN</Btn>
                  {hasPin && <Btn variant="secondary" size="sm" onClick={() => { setPinChange(false); setPinInput('') }}>Cancel</Btn>}
                </div>
              </div>
            )}
            <hr style={{ borderColor: 'var(--border)' }} />
          </div>

          {/* Session controls */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50">
               <ShieldCheck size={12} /> Privacy & Session
             </div>
             
             <div className="flex flex-wrap items-center gap-3">
                <Btn variant="secondary" size="sm" loading={resetting} onClick={async () => {
                   setResetting(true)
                   const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/dashboard` })
                   setResetting(false)
                   setResetMsg(error ? '✗ ' + error.message : '✓ Reset link sent to ' + email)
                }}>
                   Send Recovery Email
                </Btn>
                <Btn variant="danger" size="sm" icon={LogOut} onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}>
                   Sign Out Completely
                </Btn>
             </div>
             {resetMsg && <p className="text-xs" style={{ color: resetMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{resetMsg}</p>}
          </div>

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
          <span style={{fontFamily: "'Noto Sans', sans-serif"}}>{APP_NAME} Info</span>
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

      {/* ── Danger Zone ──────────────────────────────────── */}
      <Card title="⚠️ Danger Zone" subtitle="System reset actions">
        <div className="p-5">
          <div className="p-4 rounded-xl border flex items-center justify-between" 
            style={{ background: 'var(--red-dim)', borderColor: 'var(--red)' }}>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--red)' }}>Clear Local Cache & Hard Logout</div>
              <p className="text-xs opacity-70 mt-0.5" style={{ color: 'var(--red)' }}>
                This will wipe all local settings (theme, etc.) and sign you out completely.
              </p>
            </div>
            <Btn variant="danger" size="sm" onClick={async () => {
              if (!confirm('Are you sure you want to clear theme/cache and log out?')) return
              localStorage.clear()
              await supabase.auth.signOut()
              router.push('/login')
            }}>
              Execute Reset
            </Btn>
          </div>
        </div>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
