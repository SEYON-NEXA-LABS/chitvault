'use client'

import React, { useState } from "react"
import { Btn, Badge } from "@/components/ui"
import {
  ArrowRight, ShieldCheck, Zap, 
  Calculator, BookOpen, Shield, 
  CheckCircle2, Printer
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

export default function AppReferenceGuide() {
  const router = useRouter()
  const { t } = useI18n()
  const [calc, setCalc] = useState({ total: 100000, discount: 5000, members: 20, commission: 5 })

  const Term = ({ name, definition }: { name: string, definition: string }) => (
    <span className="group/term relative inline-block cursor-help border-b border-dotted border-[var(--accent)] text-[var(--accent)] font-bold px-1 transition-all hover:bg-[var(--accent-dim)] rounded">
      {name}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl text-[10px] leading-relaxed text-[var(--text2)] opacity-0 pointer-events-none group-hover/term:opacity-100 transition-opacity z-[50] text-center backdrop-blur-xl">
        <span className="block font-black uppercase tracking-widest text-[var(--accent)] mb-1">Definition</span>
        {definition}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[var(--border)]" />
      </span>
    </span>
  )

  const MathFormula = ({ title, formula, result }: any) => (
    <div className="p-6 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] shadow-sm font-mono relative group mb-4">
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <Calculator size={40} />
      </div>
      <h5 className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] mb-4">{title}</h5>
      <div className="text-sm md:text-base font-bold text-[var(--text)] mb-3 tracking-tight">
        {formula}
      </div>
      <div className="flex items-center gap-2 text-xs opacity-60">
        <ArrowRight size={14} className="text-[var(--success)]" />
        <span>{result}</span>
      </div>
    </div>
  )

  const ChapterHeader = ({ num, title, subtitle }: any) => (
    <div className="mb-12 mt-20 first:mt-0">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)] font-black text-xl shadow-lg">
          {num}
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter" style={{ color: 'var(--text)' }}>{title}</h2>
          <p className="text-sm opacity-40 uppercase tracking-widest font-bold">{subtitle}</p>
        </div>
      </div>
      <div className="h-1 w-20 bg-[var(--accent)] rounded-full opacity-20" />
    </div>
  )

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      {/* Immersive Background Decor */}
      <div className="absolute top-0 left-0 w-[40%] h-[40%] bg-[var(--accent)] opacity-[0.02] blur-[150px] -z-10" />
      <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-[var(--danger)] opacity-[0.02] blur-[150px] -z-10" />

      <div className="max-w-4xl mx-auto px-6 py-20 lg:py-32">
        
        {/* Help Book Cover */}
        <div className="space-y-8 mb-32">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-dim)] border border-[var(--accent-border)]">
            <BookOpen size={14} className="text-[var(--accent)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">CHITVAULT HELP BOOK v2.5</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.85]" style={{ color: 'var(--text)' }}>
             The Auction <br />
             <span className="italic opacity-30">Manual</span>
          </h1>
          <p className="text-xl font-medium opacity-50 leading-relaxed max-w-xl">
            A narrative guide for firm owners and staff to master the auction process, from bidding floors to final payouts.
          </p>
          <div className="flex gap-4 items-center opacity-40 text-[10px] font-black uppercase tracking-widest pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
             <span>Audit-Ready Logic</span>
             <span className="w-1 h-1 rounded-full bg-current" />
             <span>Zero Manual Errors</span>
             <span className="w-1 h-1 rounded-full bg-current" />
             <span>Legal Compliance</span>
          </div>
        </div>

        {/* Chapter 1: The Core Philosophy */}
        <section id="chapter-1">
          <ChapterHeader num="01" title="The System Philosophy" subtitle="Terminology & Integrity" />
          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--text2)] text-lg leading-relaxed font-medium">
             <p>Our platform is built on the principle of <Term name="Mathematical Integrity" definition="Ensuring every rupee is accounted for by automating the distribution logic without human manual override." />. Unlike traditional ledgers, ChitVault uses an automated auction engine to calculate dividends.</p>
             <p>The most important distinction in our system is the **Auction Discount**. In legacy systems, this might be called the "Winning Bid," but we use "Discount" because it accurately describes what the winner is sacrificing to the group.</p>
             <div className="bg-[var(--surface2)] p-6 rounded-3xl border border-[var(--border)] shadow-inner my-8">
                <h4 className="text-sm font-black uppercase tracking-widest text-[var(--accent)] mb-4">The Golden Rule</h4>
                <p className="text-sm italic">The more a winner <Term name="Discounts" definition="The amount the auction winner 'sacrifices' from the total chit value in order to take the money early." />, the more <Term name="Dividends" definition="The share of the Auction Discount distributed back to each member of the group." /> the other members receive.</p>
             </div>
          </div>
        </section>

        {/* Chapter 2: The Infrastructure */}
        <section id="chapter-2">
          <ChapterHeader num="02" title="The Infrastructure" subtitle="Groups & Tickets" />
          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--text2)] text-lg leading-relaxed font-medium">
             <p>Every auction happens within a <Term name="Chit Group" definition="A collection of members who contribute monthly to a shared pool." />. Each group has a fixed duration and total value.</p>
             <p>Members hold <Term name="Tickets" definition="A specific slot or seat in a group. A single person can hold multiple tickets in the same group." />. Each ticket carries exactly one monthly installment responsibility and exactly one claim to an auction win.</p>
          </div>
        </section>

        {/* Chapter 3: The Auction Rules */}
        <section id="chapter-3">
          <ChapterHeader num="03" title="Rules of the Auction" subtitle="Safety Floors & Caps" />
          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--text2)] text-lg leading-relaxed font-medium">
             <p>To ensure fairness and firm sustainability, we enforce strict financial rules on every bidding cycle:</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
                <div className="p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] group hover:border-[var(--accent-border)] transition-all">
                   <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] mb-4">
                      <ShieldCheck size={20} />
                   </div>
                   <h4 className="font-black text-lg mb-2">The 5% Floor</h4>
                   <p className="text-sm opacity-60 leading-relaxed">Most auctions have a <Term name="Min Discount" definition="The minimum amount a winner MUST sacrifice. This usually covers the firm's commission." />. In our standard groups, this is set to a 5% floor.</p>
                </div>
                <div className="p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] group hover:border-[var(--danger-border)] transition-all">
                   <div className="w-10 h-10 rounded-xl bg-[var(--danger-dim)] flex items-center justify-center text-[var(--danger)] mb-4">
                      <Zap size={20} />
                   </div>
                   <h4 className="font-black text-lg mb-2">The 40% Cap</h4>
                   <p className="text-sm opacity-60 leading-relaxed">To prevent members from bidding too high and losing their savings, we use a <Term name="Max Discount" definition="The maximum allowed sacrifice for a winner to ensure they still take home a reasonable amount of capital." /> cap of 40%.</p>
                </div>
             </div>

             <div className="p-8 rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface2)]/50">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 opacity-40">Foreman Commission</h4>
                <p className="text-sm">The firm captures its commission from the auction discount first. By law, this is strictly capped at **5%** of the total chit value.</p>
             </div>
          </div>
        </section>

        {/* Chapter 4: The Math Laboratory */}
        <section id="chapter-4">
          <ChapterHeader num="04" title="The Math Laboratory" subtitle="Interactive Logic Simulator" />
          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--text2)] text-lg leading-relaxed font-medium mb-12">
             <p>Understand the exact distribution flow by adjusting the values below. See how the <Term name="Sacrifice" definition="The portion of the chit value the winner gives up to take the payout." /> directly influences the per-member dividend.</p>
          </div>

          <div className="p-8 rounded-[32px] bg-[var(--surface2)] border border-[var(--border)] shadow-inner mb-12">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {[['Chit Value', 'total'], ['Auction Discount', 'discount'], ['Comm %', 'commission'], ['Members', 'members']].map(([label, key]) => (
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

             {/* Calculation Logic Displayed Live */}
             {(() => {
                const commissionAmt = (calc.total * calc.commission) / 100
                const netDividendPool = Math.max(0, calc.discount - commissionAmt)
                const div = netDividendPool / calc.members
                const payable = (calc.total / calc.members) - div
                const winnerTakeHome = calc.total - calc.discount

                return (
                  <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                           <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Group Benefit (Dividend Pool)</div>
                           <div className="text-2xl font-mono font-black text-[var(--info)]">₹{netDividendPool.toLocaleString()}</div>
                           <div className="text-[10px] opacity-40 mt-1">Split among {calc.members} members</div>
                        </div>
                        <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                           <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Winner&apos;s Net Payout</div>
                           <div className="text-2xl font-mono font-black text-[var(--success)]">₹{winnerTakeHome.toLocaleString()}</div>
                           <div className="text-[10px] opacity-40 mt-1">Amount after auction discount</div>
                        </div>
                     </div>
                     
                     <div className="bg-[var(--accent)]/10 p-6 rounded-3xl border border-[var(--accent-border)] flex items-center justify-between">
                        <div>
                           <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)] mb-1">Each Member Pays This Month</div>
                           <div className="text-3xl font-black" style={{ color: 'var(--text)' }}>₹{Math.max(0, payable).toLocaleString()}</div>
                        </div>
                        <div className="text-right hidden sm:block">
                           <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Saving vs Installment</div>
                           <div className="text-xl font-bold text-[var(--success)]">₹{div.toLocaleString()}</div>
                        </div>
                     </div>
                  </div>
                )
             })()}
          </div>
        </section>

        {/* Chapter 5: Settlement & Closing */}
        <section id="chapter-5">
          <ChapterHeader num="05" title="Settlement & Closing" subtitle="Finalizing the Month" />
          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--text2)] text-lg leading-relaxed font-medium">
             <p>Recording an auction is the first step, but **Settlement** is the second. We separate these to ensure high-fidelity audits.</p>
             <p>A <Term name="Confirmed Auction" definition="An auction that has its winner and discount recorded, calculating dividends for everyone." /> immediately updates the balances for all members, allowing them to pay their reduced installments.</p>
             <p>A <Term name="Settled Payout" definition="The actual transfer of capital to the winner. This happens after checking their outstanding dues." /> marks the actual cash outflow for the winner&apos;s prize money.</p>
          </div>

          <div className="mt-12 space-y-4">
             <MathFormula 
               title="Winner Cash Out" 
               formula="Total Chit Value - Auction Discount - (Personal Outstanding Dues)" 
               result="The actual net payout amount recorded in the voucher."
             />
             <MathFormula 
               title="Firm Income" 
               formula="Σ(Foreman Commissions from all auctions)" 
               result="The total operating revenue tracked in the Earnings report."
             />
          </div>
        </section>

        {/* Epic Final Footer */}
        <div className="mt-40 p-12 md:p-24 rounded-[64px] relative overflow-hidden text-center group" 
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-dim)] to-transparent opacity-40" />
          
          <div className="relative z-10 space-y-8">
            <div className="w-20 h-20 rounded-[28px] bg-[var(--surface)] border border-[var(--border)] shadow-2xl flex items-center justify-center mx-auto">
               <Shield className="text-[var(--accent)]" size={32} />
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">Ready to Master <br /> Your Firm?</h2>
            <p className="text-lg opacity-60 max-w-xl mx-auto font-medium">
              You now have the technical ground truth for the Entire ChitVault Ecosystem. Use this knowledge to scale with absolute confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Btn variant="primary" onClick={() => router.push('/dashboard')} className="px-12 py-5 !rounded-3xl text-lg shadow-2xl h-auto">Launch Dashboard</Btn>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Help Book v2.5 Reference Active</div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center opacity-20 text-[9px] font-black uppercase tracking-[0.5em]">
          Powered by Seyon Nexa Labs • Ultimate Help Book Edition 
        </div>
      </div>
    </div>
  )
}
