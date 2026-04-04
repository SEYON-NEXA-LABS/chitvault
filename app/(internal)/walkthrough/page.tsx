'use client'

import React from "react"
import { Card, Btn, Badge } from "@/components/ui"
import {
  LayoutDashboard, Search, Users, Gavel, 
  CreditCard, Smartphone, ShieldCheck, 
  ChevronRight, ArrowRight, Zap, Target,
  Compass, Activity, Shield, Calculator
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"

export default function AppJourneyPage() {
  const router = useRouter()
  const { t } = useI18n()

  const Chapter = ({ index, title, subtitle, description, icon: Icon, href, actionLabel, color, features }: any) => (
    <div className="relative mb-24 last:mb-0 group">
      {/* Dynamic Background Orb */}
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-700" 
        style={{ background: color }} />

      <div className="flex flex-col lg:flex-row gap-12 items-start relative z-10">
        {/* Left: Index & Connector */}
        <div className="flex flex-row lg:flex-col items-center gap-4">
           <div className="w-16 h-16 rounded-[24px] flex items-center justify-center text-2xl font-black border-2 transition-all group-hover:scale-110 shadow-xl"
             style={{ background: 'var(--surface)', borderColor: color, color: color }}>
             0{index}
           </div>
           <div className="h-[2px] w-12 lg:w-[2px] lg:h-48 bg-gradient-to-b from-transparent via-[var(--border)] to-transparent opacity-50" />
        </div>

        {/* Right: Content Card */}
        <div className="flex-1">
          <div className="mb-4 flex items-center gap-3">
             <div className="p-2.5 rounded-xl bg-[var(--surface2)] border border-[var(--border)] shadow-inner" style={{ color }}>
                <Icon size={24} />
             </div>
             <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-0.5">Phase 0{index}</h4>
                <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text)' }}>{title}</h2>
             </div>
          </div>

          <p className="text-lg font-medium opacity-60 mb-8 max-w-2xl leading-relaxed">
            {description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {features.map((f: string, i: number) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] group/feat hover:border-[var(--accent-border)] transition-colors">
                <div className="w-2 h-2 rounded-full transition-all group-hover/feat:scale-150" style={{ background: color }} />
                <span className="text-sm font-bold opacity-80">{f}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Btn variant="primary" onClick={() => router.push(href)} className="px-8 py-4 !rounded-2xl shadow-xl hover:shadow-2xl transition-all h-auto">
              {actionLabel} <ArrowRight className="ml-2" size={18} />
            </Btn>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-30">
               Audit Protocol Ready // Secure Layer
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Immersive Background */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-[var(--accent)] opacity-[0.03] blur-[150px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-[var(--danger)] opacity-[0.02] blur-[150px] -z-10" />

      <div className="max-w-6xl mx-auto px-6 py-24">
        {/* Epic Header */}
        <div className="max-w-3xl mb-32 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] shadow-sm">
            <Zap size={16} className="text-[var(--accent)]" />
            <span className="text-xs font-black uppercase tracking-[0.2em] opacity-60">System Overhaul v2.4</span>
            <div className="w-[1px] h-3 bg-[var(--border)]" />
            <span className="text-[10px] font-mono font-bold text-[var(--accent)]">EST. {new Date().getFullYear()}</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9]" style={{ color: 'var(--text)' }}>
            The Ultimate <br />
            <span className="italic" style={{ color: 'var(--accent)' }}>ChitVault</span> Journey
          </h1>

          <p className="text-xl md:text-2xl font-medium opacity-50 leading-relaxed max-w-2xl">
            Experience the next generation of financial management. From global discovery to field-optimized collections, your ultimate journey begins here.
          </p>
        </div>

        {/* The Chapters */}
        <div className="space-y-12">
          <Chapter
            index={1}
            color="var(--accent)"
            icon={Target}
            title="The Pulse of Profit"
            description="Experience real-time intelligence. Our modernized Analytics Engine transforms raw numbers into a visual heartbeat, letting you monitor collection trends and outstanding risks in a single glance."
            features={["Real-time Collection Toggles", "Aging Debt Analytics", "Growth Projections"]}
            href="/dashboard"
            actionLabel="View Dashboard"
          />

          <Chapter
            index={2}
            color="#ec4899"
            icon={Search}
            title="Global Discovery"
            description="Total control via Zero Friction commerce. Utilize the Ctrl+K Command Palette to teleport across People, Groups, and Reports instantly. Your entire ecosystem is now just a keystroke away."
            features={["Omni-search Interface", "Predictive Navigation", "Instant Action Shortcuts"]}
            href="/dashboard"
            actionLabel="Test Search"
          />

          <Chapter
            index={3}
            color="var(--info)"
            icon={Calculator}
            title="Smart Allocation"
            description="Complexity simplified. ChitVault's new Smart Logic automatically distributes consolidated payments across multiple tickets, ensuring the oldest dues are cleared first without manual intervention."
            features={["Auto-Month Distribution", "Lump Sum Processing", "Dispute-free Ledgers"]}
            href="/payments"
            actionLabel="Manage Payments"
          />

          <Chapter
            index={4}
            color="var(--success)"
            icon={Smartphone}
            title="Field Supremacy"
            description="Empower your field agents with the Collection Hub. Mobile-optimized touch surfaces and 1-tap WhatsApp reminders ensure maximum collection rates with minimum effort."
            features={["Mobile-first Registry", "1-Tap WhatsApp Alerts", "Instant Cash Recording"]}
            href="/collection"
            actionLabel="Field Hub"
          />

          <Chapter
            index={5}
            color="var(--danger)"
            icon={ShieldCheck}
            title="The Secure Vault"
            description="Total Governance. With multi-select bulk actions and the new Trash System, you can archive, restore, and audit at scale with confidence. Every byte is tracked, every action is reversible."
            features={["Bulk Status Updates", "Recovery Trash Bin", "System Audit Trails"]}
            href="/trash"
            actionLabel="Governance"
          />
        </div>

        {/* Epic Footer */}
        <div className="mt-32 p-12 md:p-24 rounded-[64px] relative overflow-hidden text-center group" 
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-dim)] to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-700" />
          
          <div className="relative z-10 space-y-8">
            <div className="w-24 h-24 rounded-[32px] bg-[var(--surface)] border border-[var(--border)] shadow-2xl flex items-center justify-center mx-auto transition-transform group-hover:scale-110 duration-500">
               <Shield className="text-[var(--accent)]" size={40} />
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">Your Digital Fortress is <br /> Ready for Scale.</h2>
            <p className="text-lg opacity-60 max-w-xl mx-auto">
              You are now operating at Alpha-9 efficiency. The journey has just begun, but your foundation is unbreakable.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Btn variant="primary" onClick={() => router.push('/dashboard')} className="px-10 py-5 !rounded-3xl text-lg shadow-2xl h-auto">Launch Command Center</Btn>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">System Protocol Active</div>
            </div>
          </div>

          {/* Background Decorative Icon */}
          <Activity size={300} className="absolute -bottom-20 -right-20 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
        </div>

        <div className="mt-12 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
          Powered by Seyon Nexa Labs • Ultimate Edition 
        </div>
      </div>
    </div>
  )
}
