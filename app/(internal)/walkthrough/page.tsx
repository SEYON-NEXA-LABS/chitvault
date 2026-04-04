'use client'

import React from "react"
import { Card, Btn, Badge } from "@/components/ui"
import {
  UserPlus, Users, Gavel, CreditCard,
  Calculator, ChevronRight, CheckCircle2,
  ArrowRight, BookOpen, Building2, Landmark, Shield
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"

import { useToast } from "@/lib/hooks/useToast"

export default function AppJourneyPage() {
  const router = useRouter()
  const { t } = useI18n()

  const Step = ({ index, title, description, icon: Icon, href, actionLabel, navLabel, ownerOnly }: any) => (
    <div className="relative pl-12 pb-12 last:pb-0">
      {/* Connector Line */}
      <div className="absolute left-[20px] top-[40px] bottom-0 w-[2px] bg-[var(--border)] last:hidden" />

      {/* Number Badge */}
      <div className="absolute left-0 top-0 w-10 h-10 rounded-full border-2 border-[var(--accent)] bg-[var(--surface)] flex items-center justify-center font-bold text-[var(--accent)] z-10">
        {index}
      </div>

      <Card className="p-6 hover:border-[var(--accent)] transition-all group overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)]">
                <Icon size={20} />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight">{title}</h3>
              {ownerOnly && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--danger-dim)] text-[var(--danger)] text-[10px] font-black uppercase tracking-tighter border border-[var(--red-border)]">
                  <Shield size={10} /> Owner Required
                </div>
              )}
            </div>
            <p className="text-sm opacity-70 leading-relaxed max-w-2xl">
              {description}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="gray" className="text-[10px]">Step {index} of 6</Badge>
              <Badge variant="info" className="text-[10px] flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-info-400" />
                Sidebar Link: {t(navLabel)}
              </Badge>
            </div>
          </div>
          <div className="shrink-0">
            <Btn icon={ArrowRight} onClick={() => router.push(href)} variant="secondary" size="sm">
              {actionLabel}
            </Btn>
          </div>
        </div>

        {/* Subtle Background Icon */}
        <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
          <Icon size={120} />
        </div>
      </Card>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto py-8">

      {/* Header section */}
      <div className="text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] text-xs font-bold uppercase tracking-widest border border-[var(--accent-border)]">
          <BookOpen size={14} />
          Complete Workflow Guide
        </div>
        <h1 className="text-4xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
          The ChitVault <span style={{ color: 'var(--accent)' }}>Journey</span>
        </h1>
        <p className="text-base opacity-60 max-w-xl mx-auto">
          From creating your first contact to settling the final payout.
          Follow these 5 steps to master your digital chit fund.
        </p>
      </div>

      {/* Vertical Timeline */}
      <div className="space-y-4">

        <Step
          index={1}
          icon={UserPlus}
          title="Create the Person (Contact)"
          description="Every member starts as a Person record. This separates their identity (name, phone) from their chit tickets. Only the Firm Owner can add new contacts to the system."
          href="/members"
          actionLabel="Add Contacts"
          navLabel="nav_members"
          ownerOnly={true}
        />

        <Step
          index={2}
          icon={Building2}
          title="Setup a Chit Group"
          description="Define your rules: total value, duration, and installment. Choose between the DIVIDEND MODEL (where auction discounts are shared monthly) or the SURPLUS MODEL (where bid amounts are pooled into a group treasury for a larger final payout)."
          href="/groups"
          actionLabel="Create Group"
          navLabel="nav_groups"
        />

        <Step
          index={3}
          icon={Users}
          title="Onboarding Members"
          description="Now, link your Persons to the Group. This assigns them a Ticket Number (e.g. Member #05). This structural change is restricted to Owners; staff must be promoted to assist here."
          href="/groups"
          actionLabel="Manage Members"
          navLabel="nav_groups"
          ownerOnly={true}
        />

        <Step
          index={4}
          icon={Gavel}
          title="Monthly Auctions & Collections"
          description="Record current month bidding and outcomes. ChitVault automatically calculates the next month's dues in the Collection Registry by applying the relevant dividends or pooling the surplus according to your group scheme."
          href="/auctions"
          actionLabel="Record Auction"
          navLabel="nav_auctions"
        />

        <Step
          index={5}
          icon={Landmark}
          title="The Integrated Cash Audit"
          description="At the end of the day or week, record your physical note counts (Denominations). The app will automatically compare this to your Digital Total (Collections - Payouts) and flag any discrepancies immediately."
          href="/cashbook"
          actionLabel="Audit Cash"
          navLabel="nav_cashbook"
        />

        <Step
          index={6}
          icon={Calculator}
          title="Final Prize Settlement"
          description="Use the Settlement Utility to finalize a group. Payouts follow the standard 'Average Payoff Rule' (Total Bids / Duration × Duration-1). You can bind calculations to a specific member for official records, or use 'Manual Mode' as a quick scratchpad."
          href="/settlement"
          actionLabel="Calculate Payout"
          navLabel="nav_settlements"
        />

      </div>

      {/* Conclusion & Next Steps */}
      <div className="mt-16 p-8 rounded-3xl border text-center space-y-6 overflow-hidden relative" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
        <div className="relative z-10">
          <CheckCircle2 size={48} className="mx-auto mb-4" style={{ color: 'var(--success)' }} />
          <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
          <p className="text-sm opacity-60 max-w-md mx-auto">
            Following these steps ensures your firm data remains clean, auditable, and easy to manage for your staff.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Btn variant="primary" onClick={() => router.push('/dashboard')}>Go to Dashboard</Btn>
            <Btn variant="secondary" onClick={() => router.push('/schemes')}>Math Guide</Btn>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Landmark size={120} />
        </div>
      </div>

    </div>
  )
}
