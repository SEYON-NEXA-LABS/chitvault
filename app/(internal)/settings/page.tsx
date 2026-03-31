'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { applyBranding, AVAILABLE_FONTS, PRESET_COLORS, COLOR_PROFILES } from '@/lib/branding/context'
import { Btn, Card, Badge, Toast } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { APP_NAME } from '@/lib/utils'
import { 
  Sun, Moon, LogOut, Key, Palette, Type, Building, Building2, 
  Smartphone, MapPin, Link, Trash2, Image as ImageIcon, ShieldCheck, User,
  Lock, LockKeyhole, Monitor
} from 'lucide-react'
import { logActivity } from '@/lib/utils/logger'
import { usePinLock } from '@/lib/lock/context'
import Image from 'next/image'

export default function SettingsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const { profile, role, firm, can, refresh } = useFirm()
  const { toast, show, hide } = useToast()
  const { isElectron, hasPin, setPin, lock } = usePinLock()

  const isSuperAdmin = role === 'superadmin'
  const isOwner = role === 'owner' || isSuperAdmin

  const [email,     setEmail]     = useState('')
  const [theme,     setTheme]     = useState<'light' | 'dark' | 'system' | 'monochrome'>('light')
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
  const [colorProfile, setColorProfile] = useState(firm?.color_profile || 'indigo')
  const [tagline,    setTagline]    = useState(firm?.tagline || 'Chit Fund Manager')
  const [font,       setFont]       = useState(firm?.font || 'Noto Sans')
  const [regToken,   setRegToken]   = useState(firm?.register_token || '')

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      setEmail(data.user?.email || '')
    }
    loadUser()
    const t = (localStorage.getItem('theme') || 'light') as 'light' | 'dark' | 'system' | 'monochrome'
    setTheme(t)
    if (firm) {
      setName(firm.name || '')
      setAddress(firm.address || '')
      setPhone(firm.phone || '')
      setColorProfile(firm.color_profile || 'indigo')
      setTagline(firm.tagline || 'Chit Fund Manager')
      setFont(firm.font || 'Noto Sans')
      setRegToken(firm.register_token || '')
    }
  }, [firm, supabase.auth])

  function updateTheme(val: 'light' | 'dark' | 'system' | 'monochrome') {
    setTheme(val)
    localStorage.setItem('theme', val)
    document.documentElement.setAttribute('data-theme', val)
  }

  function handleProfileSelect(id: string) {
    setColorProfile(id)
    // Apply immediately for preview
    document.documentElement.setAttribute('data-color-profile', id)
  }

  function handleFontChange(f: string) {
    setFont(f)
    applyBranding(f, colorProfile)
  }

  async function saveBranding() {
    if (!firm) return
    setSaving(true)
    const { error } = await supabase.from('firms').update({
      name:          name.trim() || undefined,
      address:       address.trim() || null,
      phone:         phone.trim() || null,
      color_profile: colorProfile,
      tagline:       tagline.trim() || 'Chit Fund Manager',
      font,
    }).eq('id', firm.id)
    setSaving(false)
    if (error) { show(error.message, 'error'); return }
    show('Branding saved! ✓')
    await logActivity(firm.id, 'SETTING_UPDATED', 'firm', firm.id, { field: 'branding' })
    refresh()
  }

  async function generateRegToken() {
    if (!firm) return
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 20)
    await supabase.from('firms').update({ register_token: token }).eq('id', firm.id)
    setRegToken(token)
    show('Registration link generated!')
    await logActivity(firm.id, 'SETTING_UPDATED', 'firm', firm.id, { field: 'register_token', action: 'generate' })
    refresh()
  }

  async function revokeRegToken() {
    if (!firm || !confirm('Revoke this registration link? Existing staff won\'t be affected.')) return
    await supabase.from('firms').update({ register_token: null }).eq('id', firm.id)
    setRegToken('')
    show('Link revoked.')
    await logActivity(firm.id, 'SETTING_UPDATED', 'firm', firm.id, { field: 'register_token', action: 'revoke' })
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
      {isOwner && (
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
      {isOwner && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Palette size={15} /> Branding & Appearance
          </div>
          <div className="p-5 space-y-5">

            {/* Tagline */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>
                Tagline (shown below business name on login)
              </label>
              <input className={inputClass} style={inputStyle} value={tagline}
                onChange={e => setTagline(e.target.value)} placeholder="e.g. Trusted Chit Fund Manager" />
            </div>

            {/* Color Profiles */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                <Palette size={13} /> Color Profile
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {COLOR_PROFILES.map(p => (
                  <button key={p.id} onClick={() => handleProfileSelect(p.id)}
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

            {/* Font */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                <Type size={13} /> Typography
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_FONTS.map(f => (
                  <button key={f.value} onClick={() => handleFontChange(f.value)}
                    className="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
                    style={{
                      fontFamily: `'${f.value}', sans-serif`,
                      borderColor: font === f.value ? 'var(--accent)' : 'var(--border)',
                      background: font === f.value ? 'var(--accent-dim)' : 'var(--surface2)',
                      color: font === f.value ? 'var(--accent)' : 'var(--text2)',
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
      {isOwner && (
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
              <Badge variant="success">Active Account ✓</Badge>
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
              <p className="text-sm font-medium" style={{ color: passMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
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
                  <Badge variant="success">Enabled ✓</Badge>
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
              <div className="space-y-3 p-4 bg-accent/5 rounded-xl border border-accent/20">
                <label className="text-xs font-bold text-accent uppercase tracking-wider block">Set New 4-6 Digit PIN</label>
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
             {resetMsg && <p className="text-xs" style={{ color: resetMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>{resetMsg}</p>}
          </div>

        </div>
      </Card>

      {/* ── Personal Appearance & Selection ────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          🌗 Personal Theme & Appearance
        </div>
        <div className="p-5 space-y-6">
            
            {/* Color Profiles (Personal Selection) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                  <Palette size={13} /> Personal Color Profile
                </div>
                <button 
                  onClick={() => {
                    localStorage.removeItem('chitvault-user-color-profile')
                    window.location.reload()
                  }}
                  className="text-[10px] font-bold text-[var(--accent)] hover:underline"
                >
                  Reset to Firm Default
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {COLOR_PROFILES.map(p => {
                  const isSelected = (typeof window !== 'undefined' && localStorage.getItem('chitvault-user-color-profile')) === p.id
                  return (
                    <button key={p.id} onClick={() => {
                      localStorage.setItem('chitvault-user-color-profile', p.id)
                      window.location.reload()
                    }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group"
                    style={{
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      background: isSelected ? 'var(--accent-dim)' : 'var(--surface2)',
                    }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: p.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-tight text-center" 
                      style={{ color: isSelected ? 'var(--accent)' : 'var(--text2)' }}>
                      {p.name.split(' ')[0]}
                    </span>
                  </button>
                  )
                })}
              </div>
            </div>

            <hr style={{ borderColor: 'var(--border)' }} />

            {/* High Level Theme (Light/Dark) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['light', 'dark', 'system', 'monochrome'] as const).map(m => (
                <button key={m} onClick={() => updateTheme(m)}
                  className="p-4 rounded-xl border flex flex-col items-center gap-2 transition-all group"
                  style={{
                    borderColor: theme === m ? 'var(--accent)' : 'var(--border)',
                    background: theme === m ? 'var(--accent-dim)' : 'transparent',
                  }}>
                  <div style={{ color: theme === m ? 'var(--accent)' : 'var(--text3)' }}>
                    {m === 'light' && <Sun size={20} />}
                    {m === 'dark' && <Moon size={20} />}
                    {m === 'system' && <Monitor size={20} />}
                    {m === 'monochrome' && <Palette size={20} />}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" 
                    style={{ color: theme === m ? 'var(--accent)' : 'var(--text2)' }}>
                    {m}
                  </span>
                </button>
              ))}
            </div>
           <p className="text-[11px] mt-4 opacity-50 px-1" style={{ color: 'var(--text2)' }}>
             Choose Light for a clean look, Dark for high contrast, or System to follow your device settings.
           </p>
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
            isSuperAdmin ? ['Plan', firm?.plan ? (firm.plan === 'basic' ? 'Standard' : firm.plan === 'pro' ? 'Enterprise' : firm.plan.charAt(0).toUpperCase() + firm.plan.slice(1)) : '—'] : null,
            ['Version',    process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0'],
            ['Framework',  'Next.js 14 + Supabase'],
            ['DB',         process.env.NEXT_PUBLIC_SUPABASE_URL || '—'],
          ].filter(Boolean).map(([k, v]: any) => (
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
            style={{ background: 'var(--danger-dim)', borderColor: 'var(--danger)' }}>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--danger)' }}>Clear Local Cache & Hard Logout</div>
              <p className="text-xs opacity-70 mt-0.5" style={{ color: 'var(--danger)' }}>
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
