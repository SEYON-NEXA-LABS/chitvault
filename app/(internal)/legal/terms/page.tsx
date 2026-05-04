'use client'
 
 import { ArrowLeft, Shield, Globe, Scale, BookOpen } from 'lucide-react'
 import { useRouter } from 'next/navigation'
 import { useFirm } from '@/lib/firm/context'
 import { useI18n } from '@/lib/i18n/context'
 import { Badge, Btn, Card } from '@/components/ui'
 import { APP_NAME } from '@/lib/utils'
 
 export default function TermsPage() {
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
             <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">Terms & Conditions</h1>
             <div className="flex items-center gap-2">
               <Badge variant="gray" className="text-xs font-bold uppercase tracking-widest px-2">Compliance v4.2</Badge>
               <span className="text-xs text-slate-400 font-bold uppercase tracking-widest opacity-60">Effective Apr 2024</span>
             </div>
           </div>
         </div>
         <Btn variant="secondary" onClick={() => window.print()} className="text-xs font-bold uppercase tracking-widest px-6 h-11 rounded-2xl">Download PDF</Btn>
       </div>
 
       {/* Content Cards */}
       <div className="grid gap-10">
         <section className="space-y-6">
           <div className="flex items-center gap-3 text-xl font-black text-slate-900 uppercase tracking-tight">
             <Scale size={24} className="text-[var(--accent)]" />
             <h2>1. Introduction</h2>
           </div>
           <Card className="p-8 bg-slate-50/50 border-slate-100 shadow-none">
             <p className="text-sm text-slate-600 leading-relaxed font-medium">
               Welcome to {APP_NAME}. By accessing or using our platform, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, please do not use our services. These terms apply to all visitors, users, and others who access or use the Service.
             </p>
           </Card>
         </section>
 
         <section className="space-y-6">
           <div className="flex items-center gap-3 text-xl font-black text-slate-900 uppercase tracking-tight">
             <Shield size={24} className="text-[var(--accent)]" />
             <h2>2. Usage Policy</h2>
           </div>
           <div className="grid sm:grid-cols-2 gap-6">
             <Card className="p-8 bg-white border-slate-100 hover:border-[var(--accent)] transition-colors group">
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 group-hover:text-[var(--accent)]">Compliance</h3>
               <p className="text-sm text-slate-600 leading-relaxed font-medium">
                 Users must comply with all local financial regulations and chit fund laws applicable in their jurisdiction.
               </p>
             </Card>
             <Card className="p-8 bg-white border-slate-100 hover:border-[var(--accent)] transition-colors group">
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 group-hover:text-[var(--accent)]">Security</h3>
               <p className="text-sm text-slate-600 leading-relaxed font-medium">
                 You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.
               </p>
             </Card>
           </div>
         </section>
 
         <section className="space-y-6">
           <div className="flex items-center gap-3 text-xl font-black text-slate-900 uppercase tracking-tight">
             <Globe size={24} className="text-[var(--accent)]" />
             <h2>3. Data Privacy</h2>
           </div>
           <Card className="p-8 bg-slate-900 text-white shadow-2xl rounded-[2.5rem] relative overflow-hidden">
             <div className="relative z-10 space-y-4">
               <p className="text-sm text-slate-300 leading-relaxed font-medium opacity-90">
                 Your privacy is important to us. It is our policy to respect your privacy regarding any information we may collect from you across our website and other sites we own and operate.
               </p>
               <div className="pt-4 flex gap-4">
                 <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                   <Shield size={14} /> Encrypted
                 </div>
                 <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                   <BookOpen size={14} /> GDPR Ready
                 </div>
               </div>
             </div>
             <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)] blur-[100px] opacity-20" />
           </Card>
         </section>
       </div>
 
       {/* Footer Footer */}
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
