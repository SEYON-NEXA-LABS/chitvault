'use client'
 
 import { useState, useEffect, useCallback, Suspense } from 'react'
 import { APP_DEVELOPER, APP_NAME, APP_VERSION, APP_COMMIT_ID } from '@/lib/utils/index'
 import { useRouter, useSearchParams } from 'next/navigation'
 import Link from 'next/link'
 import { createClient } from '@/lib/supabase/client'
 import { applyBranding } from '@/lib/branding/context'
 import { usePinLock } from '@/lib/lock/context'
 import { useI18n } from '@/lib/i18n/context'
 import { Download, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2, Building2, Languages, BookOpen, Globe, AlertCircle } from 'lucide-react'
 import { cn } from '@/lib/utils'
 import Image from 'next/image'
 
 interface FirmBranding {
   name: string; color_profile: string;
   font: string
 }
 
 type Tab = 'signin' | 'forgot'
 
 function LoginForm() {
   const router = useRouter()
   const searchParams = useSearchParams()
   const supabase = createClient()
   const { t, lang, setLang } = useI18n()
   const firmSlug = searchParams.get('firm')
   const { hasPin } = usePinLock()
 
   const [tab, setTab] = useState<Tab>('signin')
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState('')
   const [success, setSuccess] = useState('')
   const [showPassword, setShowPassword] = useState(false)
   const [branding, setBranding] = useState<FirmBranding>({
     name: APP_NAME,
     color_profile: 'indigo',
     font: 'Noto Sans'
   })
 
   // Form states
   const [siEmail, setSiEmail] = useState('')
   const [siPass, setSiPass] = useState('')
   const [saveCreds, setSaveCreds] = useState(true)
   const [agreed, setAgreed] = useState(true)
   const [fpEmail, setFpEmail] = useState('')
   const [shake, setShake] = useState(false)
 
   useEffect(() => {
     async function loadBranding() {
       if (!firmSlug) return
       try {
         const { data } = await supabase
           .rpc('get_firm_branding', { p_slug: firmSlug }) as any
         if (data) {
           setBranding({
             name: data.name, color_profile: data.color_profile || 'indigo',
             font: data.font || 'Noto Sans'
           })
           applyBranding(data.font || 'Noto Sans', data.color_profile || 'indigo')
         }
       } catch (err) { }
     }
     loadBranding()
   }, [firmSlug, supabase])
 
   const handleRedirect = useCallback(async (user: { id: string }) => {
     try {
       router.refresh()
       let { data: profile } = await supabase
         .from('profiles')
         .select('firm_id, role')
         .eq('id', user.id)
         .maybeSingle()
 
       if (!profile) {
         await new Promise(resolve => setTimeout(resolve, 800))
         const { data: retryProfile } = await supabase
           .from('profiles')
           .select('firm_id, role')
           .eq('id', user.id)
           .maybeSingle()
         profile = retryProfile
       }
 
       const nextPath = searchParams.get('next')
       if (!profile) { window.location.replace('/access-denied'); return }
 
       if (profile.role === 'superadmin') {
         window.location.replace(nextPath || '/superadmin/dashboard')
       } else {
         window.location.replace(nextPath || '/dashboard')
       }
     } catch (err) {
       window.location.replace(searchParams.get('next') || '/dashboard')
     }
   }, [supabase, router, searchParams])
 
   useEffect(() => {
     async function checkUser() {
       const { data } = await supabase.auth.getUser()
       if (data?.user) await handleRedirect(data.user)
     }
     checkUser()
   }, [supabase.auth, handleRedirect])
 
   async function handleSignIn(e: React.FormEvent) {
     e.preventDefault(); setError(''); 
     
     if (!agreed) {
       setError(t('login_err_terms') || 'Please accept the Terms and Privacy Policy to continue.')
       setShake(true)
       setTimeout(() => setShake(false), 500)
       return
     }
 
     setLoading(true)
     const { data: { user }, error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPass })
     if (error || !user) { setError(t('login_err_creds')); setLoading(false); return }
     setSuccess(t('login_success'))
     await handleRedirect(user)
   }
 
   async function handleForgotPassword(e: React.FormEvent) {
     e.preventDefault(); setError(''); setLoading(true)
     const { error } = await supabase.auth.resetPasswordForEmail(fpEmail, {
       redirectTo: `${window.location.origin}/reset-password`
     })
     setLoading(false)
     if (error) { setError(error.message); return }
     setSuccess(t('login_recovery_sent'))
   }
 
   return (
     <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-0 sm:p-8 overflow-x-hidden selection:bg-[var(--accent)] selection:text-white font-sans text-[#0f172a]">
 
       <div className="w-full max-w-[1100px] h-full sm:h-auto lg:min-h-[750px] flex flex-col lg:flex-row bg-white border-0 sm:border border-slate-200 rounded-none sm:rounded-[40px] overflow-hidden shadow-none sm:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] relative z-10">
 
         <div className="hidden lg:flex flex-[1] flex-col justify-between p-16 relative overflow-hidden bg-slate-50 border-r border-slate-100">
           <div className="absolute top-0 left-0 w-2 h-full bg-[var(--accent)]" />
           
           <div className="relative z-10">
             <div className="flex items-center gap-4 mb-16">
               <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                 <Image src="/icons/icon-512.png" alt="Logo" width={40} height={40} className="object-contain" />
               </div>
               <span className="text-3xl font-black text-[#0f172a] uppercase tracking-tighter font-brand">{APP_NAME}</span>
             </div>
 
             <div className="max-w-xs">
               <h1 className="text-4xl font-black text-[#0f172a] leading-[1.1] mb-8">
                 {t('login_welcome')} <br /> 
                 <span className="text-[var(--accent)]">{branding.name}</span>.
               </h1>
               <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                 {t('login_professional')}
               </p>
               <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest italic">
                 <ShieldCheck size={14} /> {t('login_external_notice')}
               </div>
             </div>
           </div>
 
           <div className="relative z-10 mt-auto pt-10 border-t border-slate-200/60 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">{APP_DEVELOPER} &copy; 2026</span>
                  <span className="text-xs font-bold text-[var(--accent)] mt-0.5">Build V{APP_VERSION} - {APP_COMMIT_ID}</span>
                </div>
                {/* <Badge variant="gray" className="bg-slate-200/50 text-slate-500 border-0">{t('login_audited')}</Badge> */}
              </div>
           </div>
         </div>
 
         <div className={cn("flex-1 flex flex-col justify-center p-6 sm:p-12 relative z-20 transition-transform", shake && "animate-shake")}>
           
           <div className="absolute top-6 right-6 flex items-center gap-1 bg-slate-50/80 p-1 rounded-xl border border-slate-100 shadow-sm">
             <button
               onClick={() => setLang('en')}
               className={cn(
                 "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                 lang === 'en' ? "bg-white text-[var(--accent)] shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
               )}
             >
               EN
             </button>
             <button
               onClick={() => setLang('ta')}
               className={cn(
                 "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                 lang === 'ta' ? "bg-white text-[var(--accent)] shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
               )}
             >
               தமிழ்
             </button>
           </div>
 
           <div className="max-w-sm w-full mx-auto">
             <div className="text-center mb-8 lg:hidden">
                <div className="inline-block p-3 bg-slate-50 rounded-[1.5rem] border border-slate-100 mb-2">
                  <Image src="/icons/icon-512.png" alt="Logo" width={40} height={40} className="mx-auto object-contain" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight font-brand">{APP_NAME}</h2>
             </div>
 
             <div className="mb-8 text-center lg:text-left">
               <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
                 {tab === 'signin' ? t('login_signin') : t('login_reset_password')}
               </h2>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest opacity-80">
                 {tab === 'signin' ? `${t('login_auth_for')} ${branding.name}` : t('login_security_check')}
               </p>
             </div>
 
             <div className="space-y-4 mb-8">
               {error && (
                 <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold flex items-center gap-3">
                   <AlertCircle size={16} /> {error}
                 </div>
               )}
               {success && (
                 <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold flex items-center gap-3">
                   <CheckCircle2 size={16} /> {success}
                 </div>
               )}
             </div>
 
             <div className="space-y-8">
               {tab === 'signin' ? (
                 <form onSubmit={handleSignIn} method="POST" className="space-y-8">
                   <div className="space-y-5">
                      <div className="space-y-1 group">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1 group-focus-within:text-[var(--accent)] transition-colors">{t('login_email')}</label>
                        <div className="relative">
                          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--accent)] transition-colors" />
                          <input
                            type="email"
                            name="email"
                            value={siEmail}
                            onChange={e => setSiEmail(e.target.value)}
                            placeholder="name@company.com"
                            required
                            className="w-full pl-11 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent text-slate-900 placeholder:text-slate-300 text-sm outline-none focus:border-[var(--accent)] focus:bg-white transition-all font-medium"
                          />
                        </div>
                      </div>
    
                      <div className="space-y-1 group">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 group-focus-within:text-[var(--accent)] transition-colors">{t('login_password')}</label>
                          <button
                            type="button"
                            onClick={() => setTab('forgot')}
                            className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] hover:opacity-70 transition-all"
                          >
                            {t('login_recovery')}
                          </button>
                        </div>
                        <div className="relative">
                          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--accent)] transition-colors" />
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={siPass}
                            onChange={e => setSiPass(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full pl-11 pr-12 py-4 rounded-2xl bg-slate-50 border-2 border-transparent text-slate-900 placeholder:text-slate-300 text-sm outline-none focus:border-[var(--accent)] focus:bg-white transition-all font-mono tracking-widest"
                            onKeyDown={e => { if (e.key === 'Enter') handleSignIn(e as any) }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-900 transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                   </div>
 
                   <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                     <label className="relative flex items-center gap-3 cursor-pointer group">
                       <div className="relative">
                         <input
                           type="checkbox"
                           checked={saveCreds}
                           onChange={e => setSaveCreds(e.target.checked)}
                           className="peer sr-only"
                         />
                         <div className="w-5 h-5 rounded-lg border-2 border-slate-200 bg-white transition-all peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)]" />
                         <CheckCircle2 size={12} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white scale-0 peer-checked:scale-100 transition-transform" />
                       </div>
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">
                         {t('login_save_creds')}
                       </span>
                     </label>
 
                     <label className="relative flex items-start gap-3 cursor-pointer group">
                       <div className="relative mt-0.5">
                         <input
                           type="checkbox"
                           checked={agreed}
                           onChange={e => { setAgreed(e.target.checked); if (e.target.checked) { localStorage.setItem('chitvault-cookie-consent', 'true'); window.dispatchEvent(new Event('cookie-consent-updated')); } }}
                           className="peer sr-only"
                         />
                         <div className={cn(
                           "w-5 h-5 rounded-lg border-2 bg-white transition-all peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)]",
                           !agreed && shake ? "border-red-500" : "border-slate-200"
                         )} />
                         <CheckCircle2 size={12} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white scale-0 peer-checked:scale-100 transition-transform" />
                       </div>
                       <span className={cn(
                         "text-xs font-bold uppercase tracking-widest transition-colors leading-tight",
                         !agreed && shake ? "text-red-500" : "text-slate-500"
                       )}>
                         {t('login_agree_to')} {' '}
                         <Link href='/legal/cookie-policy' className='text-[var(--accent)] hover:underline'>Cookies</Link> , {' '}
                         <Link href="/legal/terms" className="text-[var(--accent)] hover:underline">{t('login_terms')}</Link> , {' and '}
                         <Link href="/legal/privacy" className="text-[var(--accent)] hover:underline">{t('login_privacy')} </Link>
                       </span>
                     </label>
                   </div>
 
                   <button
                     type="submit"
                     disabled={loading}
                     className="w-full group py-5 rounded-[2rem] bg-[#0038b8] text-white font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-blue-900/10 hover:bg-[#002da0]"
                   >
                     {loading ? (
                       <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                     ) : (
                       <>
                         {t('login_enter')}
                         <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                       </>
                     )}
                   </button>
                 </form>
               ) : (
                 <form onSubmit={handleForgotPassword} method="POST" className="space-y-8">
                   <div className="space-y-2 group">
                     <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">{t('login_recovery_email')}</label>
                     <div className="relative">
                       <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--accent)] transition-colors" />
                       <input
                         type="email"
                         value={fpEmail}
                         onChange={e => setFpEmail(e.target.value)}
                         placeholder="your@email.com"
                         required
                         className="w-full pl-11 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent text-slate-900 placeholder:text-slate-300 text-sm outline-none focus:border-[var(--accent)] focus:bg-white transition-all font-medium"
                       />
                     </div>
                   </div>
 
                   <button
                     type="submit"
                     disabled={loading}
                     className="w-full py-5 rounded-[2rem] bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                   >
                     {loading ? 'Sending...' : t('login_send_recovery')}
                   </button>
 
                   <button
                     type="button"
                     onClick={() => { setTab('signin'); setError(''); setSuccess('') }}
                     className="w-full text-center text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                   >
                     &larr; {t('login_back')}
                   </button>
                 </form>
               )}
 
               <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-6">
                 <Link 
                   href="/schemes" 
                   className="group w-full py-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all flex items-center justify-center gap-3"
                 >
                   <BookOpen size={18} className="text-[var(--accent)] group-hover:text-white" />
                   <span className="text-xs font-bold uppercase tracking-widest text-slate-600 group-hover:text-white">
                     {t('login_schemes_guide')}
                   </span>
                 </Link>
 
                 <Link href="/legal" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
                   {t('login_legal_hub')}
                 </Link>
               </div>
             </div>
           </div>
         </div>
       </div>
 
       <style jsx global>{`
         @keyframes shake-animation {
           0%, 100% { transform: translateX(0); }
           20%, 60% { transform: translateX(-10px); }
           40%, 80% { transform: translateX(10px); }
         }
         .animate-shake {
           animation: shake-animation 0.4s ease-in-out;
         }
       `}</style>
     </div>
   )
 }
 
 function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
    return (
      <span className={cn(
        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border",
        variant === 'gray' ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-blue-50 border-blue-100 text-blue-600",
        className
      )}>
        {children}
      </span>
    )
 }
 
 export default function LoginPage() {
   const { t } = useI18n()
   return (
     <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 font-black tracking-widest uppercase text-sm">
         {t('login_preparing')}
       </div>
     }>
       <LoginForm />
     </Suspense>
   )
 }
