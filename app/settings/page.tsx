'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Btn, Card, Badge, Toast } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { APP_NAME } from '@/lib/utils'
import { Sun, Moon, LogOut, Key, Database } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const { toast, show, hide } = useToast()

  const [email,  setEmail]  = useState('')
  const [theme,  setTheme]  = useState<'dark'|'light'>('dark')
  const [resetting, setResetting] = useState(false)
  const [resetMsg,  setResetMsg]  = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
    const t = (localStorage.getItem('theme') || 'dark') as 'dark'|'light'
    setTheme(t)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
  }

  async function sendReset() {
    setResetting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard`
    })
    setResetting(false)
    if (error) { setResetMsg('Error: ' + error.message) }
    else { setResetMsg('✓ Reset link sent to ' + email) }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-xl space-y-4">

      {/* Account */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          👤 Account
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between py-2 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text2)' }}>Signed in as</span>
            <span className="font-semibold" style={{ color: 'var(--gold)' }}>{email}</span>
          </div>
          <div className="flex justify-between py-2 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text2)' }}>Authentication</span>
            <Badge variant="green">Supabase Auth ✓</Badge>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Btn variant="secondary" loading={resetting} onClick={sendReset}>
              <Key size={14} /> Send Password Reset Email
            </Btn>
            <Btn variant="danger" onClick={signOut}>
              <LogOut size={14} /> Sign Out
            </Btn>
          </div>
          {resetMsg && (
            <p className="text-sm mt-1" style={{ color: resetMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>
              {resetMsg}
            </p>
          )}
        </div>
      </Card>

      {/* Appearance */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          🎨 Appearance
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Theme</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
              Currently: <strong>{theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'}</strong>
            </div>
          </div>
          <Btn variant="secondary" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            Switch to {theme === 'dark' ? 'Light ☀️' : 'Dark 🌙'}
          </Btn>
        </div>
      </Card>

      {/* Database */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          🗄️ Database
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between py-2 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text2)' }}>Status</span>
            <Badge variant="green">Supabase Connected ✓</Badge>
          </div>
          <div className="flex justify-between py-2 border-b text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text2)' }}>Type</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>PostgreSQL (Supabase)</span>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span style={{ color: 'var(--text2)' }}>Project URL</span>
            <span className="text-xs font-mono truncate max-w-xs" style={{ color: 'var(--text3)' }}>
              {process.env.NEXT_PUBLIC_SUPABASE_URL}
            </span>
          </div>
        </div>
      </Card>

      {/* App Info */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          ℹ️ App Info
        </div>
        <div className="p-5 space-y-2 text-sm">
          {[
            ['Application',   APP_NAME],
            ['Version',       process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'],
            ['Framework',     'Next.js 14 + Supabase'],
            ['Database',      'PostgreSQL (Supabase free tier)'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b last:border-0"
              style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text2)' }}>{k}</span>
              <span className="font-medium" style={{ color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
