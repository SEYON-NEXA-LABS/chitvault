'use client'
 
 import { ArrowLeft, BookOpen, Calculator, Gavel, Scale, ShieldCheck, Zap } from 'lucide-react'
 import { useRouter } from 'next/navigation'
 import { useFirm } from '@/lib/firm/context'
 import { useI18n } from '@/lib/i18n/context'
 import { Badge, Btn, Card } from '@/components/ui'
 import { APP_NAME } from '@/lib/utils'
 
 export default function SchemesGuidePage() {
   const router = useRouter()
   const { profile, loading } = useFirm()
   const { t } = useI18n()
 
   const handleBack = () => {
     if (!loading && profile) {
       router.back()
     } else {
       router.push('/login')
     }
   }
 
   return (
     <div className="max-w-4xl mx-auto space-y-12 py-12 px-6">
       {/* Header Section */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-10">
         <div className="flex items-center gap-5">
           <button 
             onClick={handleBack}
             className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all shadow-sm group"
           >
             <ArrowLeft size={22} className="group-active:-translate-x-1 transition-transform" />
           </button>
           <div>
             <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">Auction Schemes Guide</h1>
             <div className="flex items-center gap-2">
               <Badge variant="accent" className="text-xs font-bold uppercase tracking-widest px-2">Educational</Badge>
               <span className="text-xs text-slate-400 font-bold uppercase tracking-widest opacity-60">System Documentation</span>
             </div>
           </div>
         </div>
         <Btn variant="secondary" onClick={() => window.print()} className="text-xs font-bold uppercase tracking-widest px-6 h-11 rounded-2xl">Print Guide</Btn>
       </div>
 
       {/* Introduction */}
       <section className="space-y-6">
         <div className="flex items-center gap-3 text-xl font-black text-slate-900 uppercase tracking-tight">
           <BookOpen size={24} className="text-[var(--accent)]" />
           <h2>Overview</h2>
         </div>
         <Card className="p-8 bg-slate-50/50 border-slate-100 shadow-none">
           <p className="text-sm text-slate-600 leading-relaxed font-medium">
             {APP_NAME} supports various auction methodologies to accommodate different chit fund operational models. Understanding these schemes is crucial for accurate financial auditing and member satisfaction.
           </p>
         </Card>
       </section>
 
       {/* Schemes Comparison */}
       <div className="grid md:grid-cols-2 gap-8">
         {/* ACCUMULATION SCHEME */}
         <section className="space-y-6">
           <div className="flex items-center gap-3 text-xl font-black text-slate-900 uppercase tracking-tight">
             <Calculator size={24} className="text-emerald-600" />
             <h2>Accumulation</h2>
           </div>
           <Card className="p-8 bg-white border-slate-200 hover:border-emerald-500 transition-all group h-full">
             <div className="flex flex-col h-full justify-between">
               <div className="space-y-4">
                 <p className="text-sm text-slate-600 leading-relaxed font-medium">
                   Members pay a fixed monthly installment. The auction discount is accumulated in a pool rather than distributed immediately.
                 </p>
                 <ul className="space-y-3">
                   <li className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                     <Zap size={14} className="text-emerald-500" /> Fixed Installments
                   </li>
                   <li className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                     <Zap size={14} className="text-emerald-500" /> Deferred Benefit
                   </li>
                 </ul>
               </div>
               <Badge variant="success" className="mt-8 self-start text-xs font-bold uppercase tracking-widest">Low Complexity</Badge>
             </div>
           </Card>
         </section>
 
         {/* DIVIDEND DISTRIBUTION */}
         <section className="space-y-6">
           <div className="flex items-center gap-3 text-xl font-black text-slate-900 uppercase tracking-tight">
             <Gavel size={24} className="text-blue-600" />
             <h2>Dividend</h2>
           </div>
           <Card className="p-8 bg-white border-slate-200 hover:border-blue-500 transition-all group h-full">
             <div className="flex flex-col h-full justify-between">
               <div className="space-y-4">
                 <p className="text-sm text-slate-600 leading-relaxed font-medium">
                   The auction discount is distributed among all members as a "dividend" reducing their next installment amount.
                 </p>
                 <ul className="space-y-3">
                   <li className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                     <Zap size={14} className="text-blue-500" /> Variable Installments
                   </li>
                   <li className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                     <Zap size={14} className="text-blue-500" /> Immediate Benefit
                   </li>
                 </ul>
               </div>
               <Badge variant="accent" className="mt-8 self-start text-xs font-bold uppercase tracking-widest">Common Model</Badge>
             </div>
           </Card>
         </section>
       </div>
 
       {/* Legal Hub Integration */}
       <section className="space-y-6 pt-12">
         <div className="flex items-center gap-3 text-xl font-black text-slate-900 uppercase tracking-tight">
           <ShieldCheck size={24} className="text-orange-500" />
           <h2>Audit Transparency</h2>
         </div>
         <Card className="p-8 bg-slate-900 text-white shadow-2xl rounded-[2.5rem] relative overflow-hidden">
           <div className="relative z-10 space-y-4">
             <p className="text-sm text-slate-300 leading-relaxed font-medium opacity-90">
               All auction calculations are performed in accordance with statutory guidelines. Our system maintains an immutable audit trail for every dividend distribution and payout settlement.
             </p>
             <div className="pt-4 flex gap-4">
               <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                 <Scale size={14} /> Legally Audited
               </div>
               <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                 <BookOpen size={14} /> Full Traceability
               </div>
             </div>
           </div>
           <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500 blur-[100px] opacity-20" />
         </Card>
       </section>
 
       {/* Footer */}
       <div className="pt-12 border-t text-center space-y-4">
         <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
           {t('login_back_to_login_msg') || "Need to go back?"}
         </p>
         <button 
           onClick={handleBack}
           className="px-8 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-900 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
         >
           {loading || profile ? "Back to Dashboard" : "Back to Login"}
         </button>
       </div>
     </div>
   )
 }
