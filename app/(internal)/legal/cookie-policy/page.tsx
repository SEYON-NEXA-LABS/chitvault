'use client'

import { Card, Badge } from '@/components/ui'
import { ArrowLeft, Cookie, ShieldCheck, Settings, Globe } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { APP_DEVELOPER } from '@/lib/utils'

export default function CookiePolicyPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { profile, loading } = useFirm()

  const handleBack = () => {
    if (!loading && profile) {
      router.back()
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="p-2.5 rounded-xl border hover:bg-[var(--surface2)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Cookie Policy</h1>
          <Badge variant="info">Essential Storage Only</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-8 md:p-12 space-y-12">
          
          <section className="space-y-6">
            <div className="flex items-center gap-3 text-blue-500">
              <ShieldCheck size={20} />
              <h2 className="text-xl font-black uppercase tracking-tight">1. Why we use cookies</h2>
            </div>
            <p className="text-[var(--text2)] leading-relaxed">
              ChitVault uses cookies and similar storage technologies (like LocalStorage) primarily to maintain your secure session and remember your firm-specific settings. 
              We do <strong>not</strong> use cookies for third-party tracking or behavioral advertising.
            </p>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 text-[var(--accent)]">
              <Settings size={20} />
              <h2 className="text-xl font-black uppercase tracking-tight">2. Essential Cookies</h2>
            </div>
            <p className="text-[var(--text2)] leading-relaxed">
              These are strictly necessary for the platform to function. They cannot be disabled.
            </p>
            <div className="bg-[var(--surface2)] p-6 rounded-3xl border border-[var(--border)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 font-black uppercase tracking-widest text-[10px] opacity-40">Name</th>
                    <th className="text-left py-3 font-black uppercase tracking-widest text-[10px] opacity-40">Purpose</th>
                    <th className="text-left py-3 font-black uppercase tracking-widest text-[10px] opacity-40">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="py-4 font-mono font-bold text-xs">sb-access-token</td>
                    <td className="py-4 text-xs opacity-70">Maintains your encrypted auth session with Supabase.</td>
                    <td className="py-4 text-xs opacity-70">Session</td>
                  </tr>
                  <tr>
                    <td className="py-4 font-mono font-bold text-xs">chitvault-theme</td>
                    <td className="py-4 text-xs opacity-70">Remembers your preferred color profile and dark/light mode.</td>
                    <td className="py-4 text-xs opacity-70">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-4 font-mono font-bold text-xs">switched_firm_id</td>
                    <td className="py-4 text-xs opacity-70">Remembers which firm context you are currently managing.</td>
                    <td className="py-4 text-xs opacity-70">Persistent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 text-emerald-500">
              <Globe size={20} />
              <h2 className="text-xl font-black uppercase tracking-tight">3. Preferences</h2>
            </div>
            <p className="text-[var(--text2)] leading-relaxed">
              We store your language preference (English/Tamil) in the browser to ensure the interface loads in your native language automatically on your next visit.
            </p>
          </section>

          <div className="footer-doc pt-12 border-t border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-40">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest">Document Ref: CV-POL-COOKIES</p>
              <p className="text-[10px]">© 2026 {APP_DEVELOPER}. All Rights Reserved.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
