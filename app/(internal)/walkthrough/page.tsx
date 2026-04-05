'use client'

import React, { useState } from "react"
import { Card, Btn, Badge } from "@/components/ui"
import {
  LayoutDashboard, Search, Users, Gavel, 
  CreditCard, Smartphone, ShieldCheck, 
  ChevronRight, ArrowRight, Zap, Target,
  Compass, Activity, Shield, Calculator,
  BookOpen, Brain, Network, Landmark,
  History, Lock, Info, CheckCircle2,
  TrendingUp, Scale, Settings
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

export default function AppReferenceGuide() {
  const router = useRouter()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('analytics')

  const TABS = [
    { id: 'analytics', label: 'Intelligence', icon: Brain },
    { id: 'architecture', label: 'Core Structure', icon: Network },
    { id: 'math', label: 'The Math', icon: Calculator },
    { id: 'ledger', label: 'Smart Ledger', icon: Landmark },
    { id: 'field', label: 'Field Hub', icon: Smartphone },
    { id: 'closure', label: 'Settlement', icon: History },
    { id: 'governance', label: 'Security', icon: Lock },
  ]

  const [calc, setCalc] = useState({ total: 100000, bid: 80000, members: 20, commission: 5 })

  const Term = ({ name, definition }: { name: string, definition: string }) => (
    <span className="group/term relative inline-block cursor-help border-b border-dotted border-[var(--accent)] text-[var(--accent)] font-bold px-1 transition-all hover:bg-[var(--accent-dim)] rounded">
      {name}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl text-[10px] leading-relaxed text-[var(--text2)] opacity-0 pointer-events-none group-hover/term:opacity-100 transition-opacity z-[200] text-center backdrop-blur-xl">
        <span className="block font-black uppercase tracking-widest text-[var(--accent)] mb-1">Definition</span>
        {definition}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[var(--border)]" />
      </span>
    </span>
  )

  const InteractiveCalculator = () => {
    const commissionAmt = (calc.total * calc.commission) / 100
    const pool = (calc.total - calc.bid) - commissionAmt
    const div = pool / calc.members
    const payable = (calc.total / calc.members) - div

    return (
      <div className="mt-8 p-8 rounded-[32px] bg-[var(--surface2)] border border-[var(--border)] shadow-inner">
        <div className="flex items-center gap-3 mb-8">
           <Calculator className="text-[var(--accent)]" size={20} />
           <h4 className="text-sm font-black uppercase tracking-widest">Live Logic Simulator</h4>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
           {[['Total Value', 'total'], ['Winning Bid', 'bid'], ['Comm %', 'commission'], ['Members', 'members']].map(([label, key]) => (
             <div key={key} className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider opacity-40">{label}</label>
                <input 
                  type="number" 
                  value={(calc as any)[key]} 
                  onChange={(e) => setCalc({ ...calc, [key]: Number(e.target.value) })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-bold text-[var(--accent)] focus:outline-none focus:border-[var(--accent)] transition-all"
                />
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {[
             ['Dividend Pool', pool, 'var(--info)'],
             ['Per Head Div', div, 'var(--success)'],
             ['Net Payable', payable, 'var(--accent)']
           ].map(([label, val, color]) => (
             <div key={label} className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                <div className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">{label}</div>
                <div className="text-xl font-mono font-black" style={{ color }}>₹{Math.max(0, val as number).toLocaleString()}</div>
             </div>
           ))}
        </div>
      </div>
    )
  }

  const MathFormula = ({ title, formula, result }: any) => (
    <div className="p-6 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] shadow-sm font-mono relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <Calculator size={40} />
      </div>
      <h5 className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] mb-4">{title}</h5>
      <div className="text-sm md:text-base lg:text-lg font-bold text-[var(--text)] mb-3 tracking-tight">
        {formula}
      </div>
      <div className="flex items-center gap-2 text-xs opacity-60">
        <ArrowRight size={14} className="text-[var(--success)]" />
        <span>{result}</span>
      </div>
    </div>
  )

  const LogicCard = ({ title, children, icon: Icon, color }: any) => (
    <div className="p-8 rounded-[32px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-border)] transition-all group relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-5 transition-opacity group-hover:opacity-10" style={{ backgroundColor: color }} />
      <div className="flex items-start gap-5 mb-6">
        <div className="p-3 rounded-2xl bg-[var(--surface2)] shadow-inner" style={{ color }}>
          <Icon size={24} />
        </div>
        <h3 className="text-xl font-black tracking-tight pt-1" style={{ color: 'var(--text)' }}>{title}</h3>
      </div>
      <div className="space-y-4 text-sm text-[var(--text2)] leading-relaxed font-medium">
        {children}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Immersive Background Decor */}
      <div className="absolute top-0 left-0 w-[40%] h-[40%] bg-[var(--accent)] opacity-[0.02] blur-[150px] -z-10" />
      <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-[var(--danger)] opacity-[0.02] blur-[150px] -z-10" />

      <div className="max-w-7xl mx-auto px-6 py-20 lg:py-32">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row items-end justify-between gap-8 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="max-w-2xl space-y-6">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-dim)] border border-[var(--accent-border)]">
               <BookOpen size={14} className="text-[var(--accent)]" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">THE ULTIMATE REFERENCE</span>
             </div>
             <h1 className="text-5xl lg:text-7xl font-black tracking-tighter leading-[0.9]" style={{ color: 'var(--text)' }}>
               Mastering the <br />
               <span className="italic opacity-60">ChitVault Ecosystem</span>
             </h1>
             <p className="text-lg font-medium opacity-50 leading-relaxed">
               Welcome to the definitive manual. Every calculation, logic engine, and module flow defined in one high-fidelity functional reference.
             </p>
           </div>
           
           <div className="hidden lg:flex items-center gap-12 text-center pb-2">
              <div>
                <div className="text-3xl font-black" style={{ color: 'var(--text)' }}>100%</div>
                <div className="text-[9px] font-black uppercase tracking-widest opacity-40">Audit Ready</div>
              </div>
              <div className="w-px h-10 bg-[var(--border)] opacity-30" />
              <div>
                <div className="text-3xl font-black" style={{ color: 'var(--accent)' }}>ZERO</div>
                <div className="text-[9px] font-black uppercase tracking-widest opacity-40">Manual Errors</div>
              </div>
           </div>
        </div>

        {/* Dynamic Navigation Bar */}
        <div className="sticky top-4 z-[100] mb-16 flex items-center justify-center">
           <div className="bg-[var(--surface)]/80 backdrop-blur-xl border border-[var(--border)] p-1.5 rounded-[24px] shadow-2xl flex flex-wrap justify-center gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-[18px] text-xs font-bold transition-all",
                      active ? "bg-[var(--accent)] text-white shadow-lg" : "text-[var(--text2)] hover:bg-[var(--surface2)]"
                    )}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
           </div>
        </div>

        {/* Content Section: Intelligence & Decision Engine */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <LogicCard title="Pulse Intelligence" icon={TrendingUp} color="var(--accent)">
               <p>The dashboard is not just a display—it&apos;s a live Decision Engine. The pulse metrics calculate collection health in real-time, matching outstanding dues against your monthly targets.</p>
               <ul className="space-y-3 pt-4">
                  <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-[var(--success)]" /> <span>Aging Debt calculation up to 90 days.</span></li>
                  <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-[var(--success)]" /> <span>Real-time Collection % vs Projection.</span></li>
               </ul>
             </LogicCard>
             <LogicCard title="Decision Grids" icon={LayoutDashboard} color="var(--info)">
               <p>Every grid is multi-threaded. Filter by group status, auction cycle, or individual member risk profile to identify bottlenecks before they affect cash flow.</p>
               <div className="mt-4 p-4 rounded-xl bg-[var(--surface2)] text-[10px] uppercase font-bold tracking-widest opacity-60">
                 System: Automated Decision Logic v2.4
               </div>
             </LogicCard>
          </div>
        )}

        {/* Content Section: Architecture & Hierarchy */}
        {activeTab === 'architecture' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <LogicCard title="The Ticket Model" icon={Users} color="#ec4899">
               <p>At the core of ChitVault is the **Ticket**. A member doesn&apos;t just join a group; they own specific slots (tickets) within it. This allows one member to hold multiple interests in the same scheme.</p>
             </LogicCard>
             <LogicCard title="Group Schemes" icon={Scale} color="var(--success)">
               <p>Defined by month, amount, and commission. Schemes govern the entire lifecycle of the fund, determining how dividend levels are capped and how bidding starts.</p>
             </LogicCard>
             <LogicCard title="Member Relations" icon={Compass} color="var(--accent)">
               <p>Complete 360° visibility. Every member profile tracks total investment, historical bidding behavior, and current delinquency level across all their tickets.</p>
             </LogicCard>
          </div>
        )}

        {/* Content Section: THE MATHEMATICAL CORE */}
        {activeTab === 'math' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <MathFormula 
                 title="Auction Dividend Pool" 
                 formula={<>(Group Total - Winning Bid) - <Term name="Foreman Commission" definition="A fixed percentage fee (usually 5%) charged by the company for managing the pool." /></>} 
                 result="The 'Discount' to be distributed among non-winners."
               />
               <MathFormula 
                 title="Member Individual Dividend" 
                 formula="Dividend Pool / Total Group Tickets" 
                 result="The exact credit applied to next month's payment."
               />
               <MathFormula 
                 title="Net Monthly Payable" 
                 formula={<>Monthly Installment - <Term name="Member Dividend" definition="The share of interest profit earned by a member from an auction winner." /></>} 
                 result="The final amount recorded in the ledger per ticket."
               />
               <MathFormula 
                 title="Foreman Profitability" 
                 formula="Fixed Commission % of Group Value" 
                 result="Calculated per auction, independent of dividends."
               />
            </div>
            
            <InteractiveCalculator />

            <div className="p-8 rounded-[32px] bg-[var(--surface2)] border-2 border-dashed border-[var(--border)] text-center max-w-2xl mx-auto">
               <h4 className="text-sm font-black uppercase tracking-widest mb-4 opacity-100">Audit Truth</h4>
               <p className="text-sm opacity-60 leading-relaxed">Every transaction is governed by these four axioms. No human override can bypass the mathematical integrity of the system.</p>
            </div>
          </div>
        )}

        {/* Content Section: Smart Ledger Logic */}
        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <LogicCard title="Auto-Month Engine" icon={Landmark} color="var(--accent)">
               <p>When a member pays a lump sum, ChitVault doesn&apos;t just &apos;add credit&apos;. The <Term name="Auto-Month" definition="An automated FIFO (First-In-First-Out) logic for clearing pending dues." /> engine scans for the **oldest pending month** and fills it first, then cascades down to the next.</p>
               <div className="mt-6 flex items-center gap-4 text-xs font-bold opacity-80">
                  <span className="p-2 rounded-lg bg-[var(--surface3)]">M1: PAID</span>
                  <ArrowRight size={14} />
                  <span className="p-2 rounded-lg bg-[var(--surface3)]">M2: PENDING</span>
                  <ArrowRight size={14} />
                  <span className="p-2 rounded-lg bg-[var(--surface3)] shadow-[0_0_10px_var(--accent-dim)]">M3: AUTO-FILL</span>
               </div>
             </LogicCard>
             <LogicCard title="Consolidated Ledgers" icon={Activity} color="var(--warning)">
               <p>A single member paying for 5 different tickets? Our Consolidated Ledger merges all ticket dues into a single screen, allowing one-tap bulk recording for the entire family or group of accounts.</p>
             </LogicCard>
          </div>
        )}

        {/* Content Section: Field Supremacy */}
        {activeTab === 'field' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <LogicCard title="Collection Registry" icon={Smartphone} color="var(--success)">
               <p>Optimized for data-parity on the go. Field agents see instant totals, last-visited history, and one-tap collection logging. Real-time sync ensures the main office sees the cash before the agent leaves the door.</p>
             </LogicCard>
             <LogicCard title="Trigger Protocols" icon={Search} color="var(--accent)">
               <p>WhatsApp Integration is more than a link. The system extracts the member&apos;s name, specific pending month, and exact total due, generating a <Term name="Dynamic Reminder" definition="A context-aware message pre-filled with the specific amounts and due dates for the member." /> in 100ms.</p>
             </LogicCard>
          </div>
        )}

        {/* Content Section: Settlement Physics */}
        {activeTab === 'closure' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <LogicCard title="Winner Payout Flow" icon={Calculator} color="var(--accent)">
               <p>Settling an auction winner? The system automatically calculates: **Winning Bid - Total Dues - Interest/Penalty**. It generates a secure settlement voucher for the payout, ensuring total audit trail.</p>
             </LogicCard>
             <LogicCard title="Group Maturity" icon={CheckCircle2} color="var(--info)">
               <p>At month-end, the system triggers the Maturity Protocol. It sweeps all non-winning tickets, creates a closure report, and generates the final payout amounts for all remaining members.</p>
             </LogicCard>
          </div>
        )}

        {/* Content Section: Governance & Security */}
        {activeTab === 'governance' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <LogicCard title="The Trash System" icon={ShieldCheck} color="var(--danger)">
               <p>Soft-delete architecture. When you delete a group or member, they move to the secure Trash bin. They can be restored with 100% data fidelity or audited for permanently removed assets.</p>
             </LogicCard>
             <LogicCard title="RLS & Audit Layers" icon={Lock} color="var(--accent)">
               <p><Term name="RLS" definition="Row-Level Security: A database security layer that ensures Firm A can never see Firm B's data, even if they share the same server." /> ensures that Firm A can never see Firm B&apos;s data, even if they share the same server. Every action is logged with time-stamps and User ID tracking.</p>
             </LogicCard>
          </div>
        )}

        {/* Epic Final Footer */}
        <div className="mt-32 p-12 md:p-24 rounded-[64px] relative overflow-hidden text-center group" 
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-dim)] to-transparent opacity-40" />
          
          <div className="relative z-10 space-y-8">
            <div className="w-20 h-20 rounded-[28px] bg-[var(--surface)] border border-[var(--border)] shadow-2xl flex items-center justify-center mx-auto">
               <Shield className="text-[var(--accent)]" size={32} />
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">The Ultimate Reference <br /> Is At Your Fingertips.</h2>
            <p className="text-lg opacity-60 max-w-xl mx-auto font-medium">
              You now have the technical ground truth for the Entire ChitVault Ecosystem. Use this knowledge to scale with absolute confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Btn variant="primary" onClick={() => router.push('/dashboard')} className="px-12 py-5 !rounded-3xl text-lg shadow-2xl h-auto">Launch Dashboard</Btn>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Reference Manual v2.4 Active</div>
            </div>
          </div>
          
          <BookOpen size={400} className="absolute -bottom-20 -right-20 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
        </div>

        <div className="mt-12 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
          Powered by Seyon Nexa Labs • Ultimate Reference Edition 
        </div>
      </div>
    </div>
  )
}
