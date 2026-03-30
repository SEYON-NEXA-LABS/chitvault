'use client'

import React from "react"
import { Card, Btn, Badge } from "@/components/ui"
import { 
  UserPlus, Users, Gavel, CreditCard, 
  Calculator, ChevronRight, CheckCircle2, 
  ArrowRight, BookOpen, Building2, Landmark
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"

export default function AppJourneyPage() {
  const router = useRouter()
  const { t } = useI18n()

  const Step = ({ index, title, description, icon: Icon, href, actionLabel, navLabel }: any) => (
    <div className="relative pl-12 pb-12 last:pb-0">
      {/* Connector Line */}
      <div className="absolute left-[20px] top-[40px] bottom-0 w-[2px] bg-[var(--border)] last:hidden" />
      
      {/* Number Badge */}
      <div className="absolute left-0 top-0 w-10 h-10 rounded-full border-2 border-[var(--gold)] bg-[var(--surface)] flex items-center justify-center font-bold text-[var(--gold)] z-10">
        {index}
      </div>

      <Card className="p-6 hover:border-[var(--gold)] transition-all group overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)]">
                <Icon size={20} />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight">{title}</h3>
            </div>
            <p className="text-sm opacity-70 leading-relaxed max-w-2xl">
              {description}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
               <Badge variant="gray" className="text-[10px]">Step {index} of 6</Badge>
               <Badge variant="blue" className="text-[10px] flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] text-xs font-bold uppercase tracking-widest border border-[var(--gold-border)]">
          <BookOpen size={14} />
          Complete Workflow Guide
        </div>
        <h1 className="text-4xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
          The ChitVault <span style={{ color: 'var(--gold)' }}>Journey</span>
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
          description="Every member starts as a Person record. This separates their identity (name, phone) from their chit tickets. You only need to create a Person once, even if they join 10 different groups."
          href="/members"
          actionLabel="Add Contacts"
          navLabel="nav_members"
        />

        <Step 
          index={2}
          icon={Building2}
          title="Setup a Chit Group"
          description="Create a Group to define the rules: the total chit value (e.g. 5 Lakhs), the monthly installment, and the duration (e.g. 20 months). Choose your auction scheme: Dividend or Accumulation."
          href="/groups"
          actionLabel="Create Group"
          navLabel="nav_groups"
        />

        <Step 
          index={3}
          icon={Users}
          title="Onboarding Members"
          description="Now, link your Persons to the Group. This is where you assign them a Ticket Number (e.g. Member #05). Once all spots are filled, the chit group is ready to start!"
          href="/groups"
          actionLabel="Manage Members"
          navLabel="nav_groups"
        />

        <Step 
          index={4}
          icon={Gavel}
          title="Monthly Auctions & Collections"
          description="Every month, record the Auction winner and their bid amount. Then, collect Payments from every member. This builds your 'Digital Total' automatically."
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
          description="When it's time to pay out the prize money, use the Settlement Utility. It calculates the final amount after all deductions and creates a persistent record for audit proof."
          href="/settlement"
          actionLabel="Calculate Payout"
          navLabel="nav_settlements"
        />

      </div>

      {/* Conclusion & Next Steps */}
      <div className="mt-16 p-8 rounded-3xl border text-center space-y-6 overflow-hidden relative" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
        <div className="relative z-10">
          <CheckCircle2 size={48} className="mx-auto mb-4" style={{ color: 'var(--green)' }} />
          <h2 className="text-2xl font-bold">You're all set!</h2>
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
