'use client'

import { Card, Badge, StatCard, Btn } from '@/components/ui'
import { Gavel, TrendingDown, Target, HelpCircle, ArrowLeft, ArrowRight, ShieldCheck, Calculator, Save, UserCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { fmt } from '@/lib/utils'

export default function SchemesGuidePage() {
  const router = useRouter()

  const ExampleRow = ({ label, dividend, accumulation, color }: any) => (
    <div className="grid grid-cols-2 gap-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">{label}</span>
        <span className="text-sm font-semibold" style={{ color: color }}>{dividend}</span>
      </div>
      <div className="flex flex-col text-right">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">{label}</span>
        <span className="text-sm font-semibold" style={{ color: color }}>{accumulation}</span>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2.5 rounded-xl border hover:bg-[var(--surface2)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Auction Schemes Guide</h1>
          <p className="text-sm opacity-60">Understanding Dividend-Share vs. Surplus-Accumulation models</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Dividend Model */}
        <Card className="p-6 relative overflow-hidden group border-t-4 border-t-blue-500">
           <Badge variant="blue" className="mb-4">Option A</Badge>
           <h2 className="text-xl font-bold mb-2">Standard (Dividend Share)</h2>
           <p className="text-sm opacity-70 leading-relaxed mb-6">
             In this model, the &quot;Discount&quot; (bid amount) is divided equally among all members every month. 
             Members pay less than their target installment, sharing the profit immediately.
           </p>
           
           <div className="bg-[var(--surface2)] p-4 rounded-xl space-y-1">
              <ExampleRow label="Monthly Installment" dividend="₹30,000" accumulation="—" color="var(--text)" />
              <ExampleRow label="Winning Bid (Discount)" dividend="₹70,000" accumulation="—" color="var(--red)" />
              <ExampleRow label="Dividend (15 members)" dividend="₹4,666" accumulation="—" color="var(--green)" />
              <ExampleRow label="Member Pays This Month" dividend="₹25,334" accumulation="—" color="var(--blue)" fontWeight="bold" />
           </div>
           
           <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-blue-500">
             <ShieldCheck size={14} /> Immediate savings for all members.
           </div>
        </Card>

        {/* Accumulation Model */}
        <Card className="p-6 relative overflow-hidden group border-t-4 border-t-[var(--gold)]">
           <Badge variant="gold" className="mb-4">Option B</Badge>
           <h2 className="text-xl font-bold mb-2">Accumulation (Surplus Model)</h2>
           <p className="text-sm opacity-70 leading-relaxed mb-6">
             Everyone pays the **Full Amount** every month. The &quot;Bid&quot; is stored in a **Surplus Pool**. 
             When the pool is large enough, it pays for the final months automatically!
           </p>

           <div className="bg-[var(--surface2)] p-4 rounded-xl space-y-1">
              <ExampleRow label="Monthly Installment" dividend="—" accumulation="₹30,000" color="var(--text)" />
              <ExampleRow label="To Surplus Pool" dividend="—" accumulation="+ ₹70,000" color="var(--gold)" />
              <ExampleRow label="Winner Payout" dividend="—" accumulation="₹380,000" color="var(--green)" />
              <ExampleRow label="Member Pays This Month" dividend="—" accumulation="₹30,000" color="var(--blue)" fontWeight="bold" />
           </div>

           <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[var(--gold)]">
             <Target size={14} /> Group closes 3-5 months early.
           </div>
        </Card>
      </div>

      {/* Detailed Math Explanation */}
      <Card title="🎓 Deep Dive: How Accumulation Logic Works" subtitle="Math example for a 15-month, 15-member group (₹4.5L pot)">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Phase 1: Collection</div>
              <p className="text-xs leading-relaxed opacity-70">
                15 members pay ₹30,000 each = **₹450,000** collected by the firm.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Phase 2: Auction</div>
              <p className="text-xs leading-relaxed opacity-70">
                Someone bids **₹70,000**. The firm pays the winner **₹380,000** (₹450k - ₹70k).
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Phase 3: The Reserve</div>
              <p className="text-xs leading-relaxed opacity-70">
                The ₹70,000 left over stays in your bank. It is the **Surplus**.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-dashed flex items-start gap-4" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
            <div className="p-2 rounded-lg bg-red-400/10 text-red-500"><TrendingDown size={20} /></div>
            <div>
              <h4 className="text-sm font-bold mb-1 underline decoration-red-500/30">The Closing Magic</h4>
              <p className="text-xs opacity-70 leading-relaxed">
                If Month 1 Surplus is ₹70k, Month 2 is ₹60k, and Month 3 is ₹50k... your pool now has ₹180k. 
                Keep going until the Pool = **₹450,000**. 
                Now, you have enough cash to pay 1 full member **without anyone paying another rupee!**
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Settlement Process */}
      <Card title="🏆 Settlement & Payout Process" subtitle="How to finalize a winner's payout and record it">
         <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="flex flex-col items-center text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                     <UserCheck size={24} />
                  </div>
                  <h4 className="font-bold text-sm">1. Link Member</h4>
                  <p className="text-xs opacity-60">Select the winner. Their auction &quot;Net Payout&quot; will auto-fill as the base for the settlement.</p>
               </div>
               <div className="flex flex-col items-center text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                     <Calculator size={24} />
                  </div>
                  <h4 className="font-bold text-sm">2. Apply 15-Mo Rule</h4>
                  <p className="text-xs opacity-60">The total amount is divided by 15. The system then calculates the 14-month balance automatically.</p>
               </div>
               <div className="flex flex-col items-center text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                     <Save size={24} />
                  </div>
                  <h4 className="font-bold text-sm">3. Save Record</h4>
                  <p className="text-xs opacity-60">Save to the database to create a permanent audit trail and proof of payout for the member.</p>
               </div>
            </div>

            <div className="p-5 rounded-2xl border bg-[var(--surface2)]" style={{ borderColor: 'var(--border)' }}>
               <h4 className="text-sm font-bold mb-3 underline decoration-[var(--gold)]/30">Why is this important?</h4>
               <ul className="space-y-3">
                  <li className="text-xs opacity-80 flex gap-2">
                     <span className="text-[var(--gold)]">•</span>
                     <span>**Transparency**: You can show the member exactly how their payout was derived using the handwritten chit rules.</span>
                  </li>
                  <li className="text-xs opacity-80 flex gap-2">
                     <span className="text-[var(--gold)]">•</span>
                     <span>**Accuracy**: Auto-fill prevents typing errors by pulling directly from verified auction outcomes.</span>
                  </li>
                  <li className="text-xs opacity-80 flex gap-2">
                     <span className="text-[var(--gold)]">•</span>
                     <span>**Compliance**: Persistent records ensure that if a member disputes a payout months later, you have the digital receipt.</span>
                  </li>
               </ul>
            </div>
         </div>
      </Card>

      {/* Commission Rules */}
      <Card title="💼 Firm Commission Types" subtitle="The different ways the foreman earns revenue">
         <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <div>
                  <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                    <span className="p-1 rounded bg-blue-500/10 text-blue-500 font-mono text-[10px]">NEW</span>
                    % of Payout (Deducted)
                  </h4>
                  <p className="text-xs opacity-60 leading-relaxed">
                    Ideal for Accumulation. If the winner gets ₹380,000, you deduct 1-5% (e.g. ₹3,800) as your fee before handing over the cheque. 
                    Simple and profitable.
                  </p>
               </div>
               <div>
                  <h4 className="text-sm font-bold mb-2">% of Chit Value</h4>
                  <p className="text-xs opacity-60 leading-relaxed">
                    Standard 5%. You take ₹22,500 every month from the pot before distributing anything.
                  </p>
               </div>
            </div>

            <div className="space-y-4">
               <div>
                  <h4 className="text-sm font-bold mb-2">% of Discount</h4>
                  <p className="text-xs opacity-60 leading-relaxed">
                    You take a cut of the bid amount. If someone bids ₹70,000 and your rate is 10%, you earn ₹7,000.
                  </p>
               </div>
               <div>
                  <h4 className="text-sm font-bold mb-2">Fixed Amount</h4>
                  <p className="text-xs opacity-60 leading-relaxed">
                    A flat fee (e.g. ₹500) per member or per auction. predictable and easy to explain.
                  </p>
               </div>
            </div>
         </div>
      </Card>

      <div className="flex justify-center pt-5">
         <Btn variant="primary" icon={ArrowRight} onClick={() => router.push('/groups')}>Go to Groups</Btn>
      </div>

    </div>
  )
}
