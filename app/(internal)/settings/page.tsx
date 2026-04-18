'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { applyBranding, AVAILABLE_FONTS, PRESET_COLORS, COLOR_PROFILES, useBranding } from '@/lib/branding/context'
import { Btn, Card, Badge, Toast } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { APP_NAME, APP_VERSION, APP_COMMIT_ID, fmtDate } from '@/lib/utils'
import {
  Sun, Moon, LogOut, Key, Palette, Type, Building, Building2,
  Smartphone, MapPin, Link, Trash2, Image as ImageIcon, ShieldCheck, User,
  Lock, LockKeyhole, Monitor, BarChart3
} from 'lucide-react'
import { logActivity } from '@/lib/utils/logger'
import { usePinLock } from '@/lib/lock/context'
import { useUsage } from '@/lib/hooks/useUsage'
import { useTheme } from '@/lib/theme/context'
import Image from 'next/image'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { profile, role, firm, can, refresh } = useFirm()
  const { theme, setTheme } = useTheme()
  const { toast, show, hide } = useToast()
  const { isElectron, hasPin, setPin, lock } = usePinLock()

  const isSuperAdmin = role === 'superadmin'
  const isOwner = role === 'owner' || isSuperAdmin

  const { data: usageData } = useUsage(isSuperAdmin ? 'all' : firm?.id)

  const [email, setEmail] = useState('')
  const [resetting, setResetting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passMsg, setPassMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

  const [pinInput, setPinInput] = useState('')
  const [pinChange, setPinChange] = useState(false)

  // Branding form state
  const [name, setName] = useState(firm?.name || '')
  const [address, setAddress] = useState(firm?.address || '')
  const [phone, setPhone] = useState(firm?.phone || '')
  const [font, setFont] = useState(firm?.font || 'Noto Sans')
  const [colorProfile, setColorProfile] = useState(firm?.color_profile || 'indigo')
  const [regToken, setRegToken] = useState(firm?.register_token || '')
  const [enabledSchemes, setEnabledSchemes] = useState<string[]>(firm?.enabled_schemes || ['DIVIDEND', 'ACCUMULATION'])

  const [stats, setStats] = useState({ groupCount: 0, memberCount: 0 })

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      setEmail(data.user?.email || '')
    }
    loadUser()

    async function loadStats() {
      if (!firm) return
      const [g, m] = await Promise.all([
        supabase.from('groups').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id)
      ])
      setStats({ groupCount: g.count || 0, memberCount: m.count || 0 })
    }
    loadStats()
    if (firm) {
      setName(firm.name || '')
      setAddress(firm.address || '')
      setPhone(firm.phone || '')
      setFont(firm.font || 'Noto Sans')
      setColorProfile(firm.color_profile || 'indigo')
      setRegToken(firm.register_token || '')
      setEnabledSchemes(firm.enabled_schemes || ['DIVIDEND', 'ACCUMULATION'])
    }
  }, [firm, supabase])




  function handleFontChange(f: string) {
    setFont(f)
    applyBranding(f, theme)
  }

  // Profile state
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [profileSaving, setProfileSaving] = useState(false)

  async function saveProfile() {
    if (!profile) return
    setProfileSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim()
    }).eq('id', profile.id)
    setProfileSaving(false)
    if (error) { show(error.message, 'error'); return }
    show('Profile updated successfully! ✓')
    refresh() // This will update the sidebar name immediately
  }

  async function saveBranding() {
    if (!firm) return
    setSaving(true)
    const { error } = await supabase.from('firms').update({
      name: name.trim() || undefined,
      address: address.trim() || null,
      phone: phone.trim() || null,
      font,
      color_profile: colorProfile,
      enabled_schemes: enabledSchemes,
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

      {/* ── Personal Appearance (All Users) ────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <Monitor size={15} /> Platform Appearance & Contrast
        </div>
        <div className="p-5">
          <p className="text-xs opacity-60 mb-4 font-medium leading-relaxed">
            Customize how ChitVault looks on this device. These settings are personal to you and don&apos;t affect other users.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'light', name: 'Light', icon: Sun },
              { id: 'dark', name: 'Dark', icon: Moon },
              { id: 'system', name: 'System', icon: Monitor },
              { id: 'mono', name: 'Monochrome', icon: Palette }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setTheme(mode.id as any)}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-2 group ${theme === mode.id
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-[var(--border)] bg-[var(--surface2)] hover:border-indigo-200'
                  }`}
              >
                <div className={`p-2 rounded-xl transition-colors ${theme === mode.id ? 'bg-indigo-600 text-white' : 'bg-[var(--surface)] text-[var(--text2)] group-hover:text-indigo-600'
                  }`}>
                  <mode.icon size={18} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider ${theme === mode.id ? 'text-indigo-600' : 'opacity-40'
                  }`}>{mode.name}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Firm Profile (Superadmin Only) ────────────────── */}
      {isSuperAdmin && (
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
                <input className={inputClass} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} maxLength={10} pattern={"[0-9]{10}"} placeholder="e.g. 9876543210" />
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

      {/* ── Branding & Aesthetics (Superadmin Only) ────────────────────── */}
      {isSuperAdmin && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Palette size={15} /> Firm-Wide Branding & Aesthetics
          </div>
          <div className="p-5 space-y-8">

            {/* Global Color Profile */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                <Palette size={13} /> Global Brand Theme
              </div>
              <p className="text-[10px] opacity-40 mb-3 uppercase font-bold tracking-widest">Sets the default accent color for all users in this firm</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COLOR_PROFILES.map(cp => (
                  <button key={cp.id}
                    onClick={() => { setColorProfile(cp.id); applyBranding(font, cp.id) }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[11px] font-bold transition-all"
                    style={{
                      borderColor: colorProfile === cp.id ? 'var(--accent)' : 'var(--border)',
                      background: colorProfile === cp.id ? 'var(--accent-dim)' : 'var(--surface2)',
                      color: colorProfile === cp.id ? 'var(--accent)' : 'var(--text)',
                    }}>
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: cp.color }} />
                    <span className="truncate">{cp.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font */}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                <Type size={13} /> Corporate Typography
              </div>
              <p className="text-[10px] opacity-40 mb-3 uppercase font-bold tracking-widest">Default font stack for reports and dashboards</p>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_FONTS.map(f => (
                  <button key={f.value} onClick={() => handleFontChange(f.value)}
                    className="text-left px-4 py-3 rounded-lg border text-sm transition-all"
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
                Apply Global Branding
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* ── Business Model & Schemes (Owner Only) ────────────────────── */}
      {isOwner && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <ShieldCheck size={15} /> Business Models & Auction Schemes
          </div>
          <div className="p-5 space-y-4">
            <p className="text-xs opacity-60 mb-2">
              Select which auction models your firm supports. This will customize your terminology and available options globally.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Accumulation Model */}
              <button
                onClick={() => {
                  const val = enabledSchemes.includes('ACCUMULATION')
                    ? (enabledSchemes.length > 1 ? enabledSchemes.filter(s => s !== 'ACCUMULATION') : enabledSchemes)
                    : [...enabledSchemes, 'ACCUMULATION']
                  setEnabledSchemes(val)
                }}
                className="p-4 rounded-2xl border text-left transition-all"
                style={{
                  borderColor: enabledSchemes.includes('ACCUMULATION') ? 'var(--info)' : 'var(--border)',
                  background: enabledSchemes.includes('ACCUMULATION') ? 'var(--info-dim)' : 'transparent'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--info)] text-white flex items-center justify-center font-black">S</div>
                  {enabledSchemes.includes('ACCUMULATION') && <Badge variant="info">Active</Badge>}
                </div>
                <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>Surplus Model (Accumulation)</div>
                <p className="text-[10px] mt-1 opacity-60">
                  Member savings are collected in a pool. Fixed prize money is paid to the winner. Best for long-term saving groups.
                </p>
              </button>

              {/* Dividend Model */}
              <button
                onClick={() => {
                  const val = enabledSchemes.includes('DIVIDEND')
                    ? (enabledSchemes.length > 1 ? enabledSchemes.filter(s => s !== 'DIVIDEND') : enabledSchemes)
                    : [...enabledSchemes, 'DIVIDEND']
                  setEnabledSchemes(val)
                }}
                className="p-4 rounded-2xl border text-left transition-all"
                style={{
                  borderColor: enabledSchemes.includes('DIVIDEND') ? 'var(--accent)' : 'var(--border)',
                  background: enabledSchemes.includes('DIVIDEND') ? 'var(--accent-dim)' : 'transparent'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center font-black">D</div>
                  {enabledSchemes.includes('DIVIDEND') && <Badge variant="accent">Active</Badge>}
                </div>
                <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>Dividend Model (Conventional)</div>
                <p className="text-[10px] mt-1 opacity-60">
                  Auction discounts are distributed back to members each month. Installments vary. Standard chit fund approach.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="primary" loading={saving} onClick={saveBranding}>
                Update Business Models
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>Display Name</label>
                <input 
                  className={inputClass} 
                  style={inputStyle} 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)} 
                  placeholder="Your full name"
                />
              </div>
              <div className="flex items-end">
                <Btn variant="primary" size="sm" loading={profileSaving} onClick={saveProfile} disabled={!fullName}>
                  Save Name
                </Btn>
              </div>
            </div>

            <div className="flex justify-between py-2.5 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
              <span className="opacity-60">Email Address</span>
              <span className="font-semibold">{email}</span>
            </div>
          </div>

          {/* Direct Password Update */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50">
              <Key size={12} /> Change Password
            </div>

            <form onSubmit={(e) => { e.preventDefault(); updatePassword(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" name="username" autoComplete="username" value={email} readOnly className="hidden" aria-hidden="true" />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>New Password</label>
                <input
                  className={inputClass}
                  style={inputStyle}
                  type="password"
                  name="new_password"
                  autoComplete="new-password"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="Minimum 6 chars"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>Confirm Password</label>
                <input
                  className={inputClass}
                  style={inputStyle}
                  type="password"
                  name="confirm_password"
                  autoComplete="new-password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder="Retype password"
                />
              </div>
              <div className="md:col-span-2">
                <Btn variant="primary" loading={passLoading} type="submit" size="sm" disabled={!newPass}>
                  Update Password
                </Btn>
              </div>
            </form>
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />

          {/* App PIN Lock (Web & Desktop) */}
          <hr style={{ borderColor: 'var(--border)' }} />
          <div className="space-y-4 pt-2 scroll-mt-20" id="lock-config">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50">
              <Lock size={12} /> App PIN Lock
            </div>

            <div className="flex items-center justify-between bg-[var(--surface2)] p-4 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-sm font-semibold">Requirement PIN on Startup</div>
                <p className="text-xs opacity-60">Secure your session with a 4-digit code.</p>
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
                <Btn variant="primary" size="sm" onClick={lock} className="!bg-[var(--accent)] !text-white !font-black !px-6 shadow-lg shadow-[var(--accent-dim)]">
                  Lock Vault Now
                </Btn>
              </div>
            )}

            {(pinChange || !hasPin) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPin(pinInput); setPinInput(''); setPinChange(false); show('4-Digit PIN Saved Successfully!');
                }}
                className="space-y-3 p-4 bg-accent/5 rounded-xl border border-accent/20"
              >
                <label className="text-xs font-bold text-accent uppercase tracking-wider block">Set New 4-Digit PIN</label>
                {/* Hidden fields for Password Manager association */}
                <input type="text" name="username" autoComplete="username" value="chitvault-pin" readOnly className="hidden" aria-hidden="true" />

                <div className="flex gap-2">
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    maxLength={4}
                    className={inputClass}
                    style={{ ...inputStyle, width: 100, letterSpacing: 8, textAlign: 'center', fontSize: 18 }}
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                  />
                  <Btn variant="primary" type="submit" size="sm" disabled={pinInput.length !== 4}>Save PIN</Btn>
                  {hasPin && <Btn variant="secondary" size="sm" onClick={() => { setPinChange(false); setPinInput('') }}>Cancel</Btn>}
                </div>
              </form>
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

      {/* ── Resource Utilization (Moved from Dashboard) ────────────────── */}
      {isOwner && (
        <Card title="📊 Plan & Resource Usage" subtitle="Monitor your egress bandwidth and plan limits.">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase opacity-40">Monthly Egress Attribution</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black">
                    {usageData ? (usageData.egress.total_estimate / (1024 * 1024)).toFixed(1) : '0'} MB
                  </span>
                  <span className="text-xs opacity-40">/ 5GB Limit</span>
                </div>
              </div>
              <Btn variant="secondary" size="sm" onClick={() => router.push('/usage')}>
                Full Usage Hub
              </Btn>
            </div>

            <div className="h-2 rounded-full bg-[var(--surface3)] overflow-hidden mb-3">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-1000"
                style={{ width: `${Math.min(100, (usageData?.egress.total_estimate || 0) / (5 * 1024 * 1024 * 1024) * 100)}%` }}
              />
            </div>

            <p className="text-[10px] opacity-60 font-medium">
              Egress is updated every 15 minutes. To reduce bandwidth, avoid frequent full-page reloads and redundant reports.
            </p>
          </div>
        </Card>
      )}

      {/* ── Firm Passport & Identity ───────────────────────────────────── */}
      <Card className="overflow-hidden border-2 shadow-xl" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
        <div className="px-5 py-4 border-b font-bold flex items-center justify-between"
          style={{ borderColor: 'var(--accent-dim)', color: 'var(--accent)', background: 'var(--accent-dim)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} />
            <span className="uppercase tracking-widest text-[10px]">Official Firm Passport</span>
          </div>
          <Badge variant="success" className="font-mono text-[9px] px-2">Live System v${APP_VERSION}</Badge>
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-8 border-b border-dashed" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text)' }}>{firm?.name}</h3>
              <p className="text-xs font-mono opacity-50 mt-1 uppercase">Reference ID: {firm?.id.substring(0, 8)}... <button onClick={() => { navigator.clipboard.writeText(firm?.id || ''); show('Reference ID Copied!') }} className="inline-flex ml-1 p-1 hover:bg-accent/10 rounded transition-colors text-accent"><Link size={10} /></button></p>
            </div>
            <div className="bg-[var(--surface2)] px-4 py-2 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[10px] font-bold uppercase opacity-40">Account Tier</div>
              <div className="text-sm font-black text-[var(--accent)] tracking-wide uppercase">{firm?.plan} Enterprise</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Partner Since</div>
              <div className="text-sm font-bold">{fmtDate(firm?.created_at)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Security Status</div>
              <div className="text-sm font-bold text-[var(--success)] flex items-center gap-1">Encrypted <ShieldCheck size={14} /></div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Active Groups</div>
              <div className="text-sm font-bold">{stats.groupCount} Managed</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Total Members</div>
              <div className="text-sm font-bold">{stats.memberCount} Enrolled</div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t flex flex-wrap gap-4" style={{ borderColor: 'var(--border)' }}>
            <div className="text-[10px] font-medium opacity-50 flex items-center gap-1.5"><Monitor size={12} /> Platform: ChitVault v{APP_VERSION} ({APP_COMMIT_ID})</div>
            <div className="text-[10px] font-medium opacity-50 flex items-center gap-1.5"><LockKeyhole size={12} /> Security: High-Fidelity Audit Trails Enabled</div>
          </div>
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
