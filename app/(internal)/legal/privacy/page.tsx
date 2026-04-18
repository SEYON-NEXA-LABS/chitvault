'use client'

import { Card, Badge } from '@/components/ui'
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

export default function PrivacyPage() {
  const router = useRouter()
  const { t } = useI18n()

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2.5 rounded-xl border hover:bg-[var(--surface2)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{t('legal_privacy')}</h1>
          <Badge variant="success">Data Protection Guaranteed</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-8 md:p-12 space-y-12">
          
          <section className="space-y-6">
            <div className="flex items-center gap-3 text-[var(--accent)]">
              <Lock size={20} />
              <h2 className="text-xl font-black uppercase tracking-tight">1. Multi-Tenant Isolation</h2>
            </div>
            <p className="text-[var(--text2)] leading-relaxed">
              ChitVault is built on a multi-tenant architecture designed to ensure that each Firm’s data is strictly isolated.
              Data is filtered by a mandatory <code>firm_id</code> at the database level using <strong>Row Level Security (RLS)</strong>.
              Users from Firm A can never view, search, or interact with data belonging to Firm B.
            </p>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 text-info-500">
              <EyeOff size={20} />
              <h2 className="text-xl font-black uppercase tracking-tight">2. Data Ownership & KYC</h2>
            </div>
            <div className="bg-[var(--surface2)] p-6 rounded-3xl border border-[var(--border)]">
              <p className="text-sm opacity-80 leading-relaxed mb-6 font-semibold">
                ChitVault does not collect official KYC (ID proofs) of your members. Firms are the &quot;Data Controllers&quot; and manage member identification locally.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[var(--surface3)] space-y-1">
                  <h4 className="text-[10px] font-black uppercase opacity-40">Data Processor Role</h4>
                  <p className="text-xs">Foundation Finance Systems only processes data on the Firm&apos;s behalf.</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--surface3)] space-y-1 border border-red-500/20">
                  <h4 className="text-[10px] font-black uppercase text-red-500">KYC Policy</h4>
                  <p className="text-xs">ID documents (Aadhaar/PAN) should NEVER be uploaded.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 text-red-500">
              <Trash2 size={20} />
              <h2 className="text-xl font-black uppercase tracking-tight">3. Retention & Trash</h2>
            </div>
            <p className="text-[var(--text2)] leading-relaxed">
              Accidental deletions are protected by our <strong>Trash System</strong>. 
              Deleted groups or members are held in a secure &quot;Trash&quot; state for <strong>90 days</strong> before permanent scrubbing from our production databases.
            </p>
          </section>

          <div className="footer-doc pt-12 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-40">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest">Document Ref: CV-POL-PRIVACY</p>
              <p className="text-[10px]">© 2026 Foundation Finance Systems. All Rights Reserved.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
