'use client'
 
 import { ArrowLeft, Building2 } from 'lucide-react'
 import { useRouter } from 'next/navigation'
 import Image from 'next/image'
 import Link from 'next/link'
 
 export default function PublicContentLayout({ children }: { children: React.ReactNode }) {
   const router = useRouter()
 
   return (
     <div className="min-h-screen bg-[var(--surface1)] selection:bg-[var(--accent)] selection:text-white">
       {/* Public Header */}
       <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[var(--surface1)]/80 backdrop-blur-xl">
         <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
           <Link href="/login" className="flex items-center gap-3">
             <Image src="/icons/icon-512.png" alt="Logo" width={32} height={32} />
             <span className="text-xl font-black uppercase tracking-tighter hidden sm:block">ChitVault</span>
           </Link>
 
           <div className="flex items-center gap-4">
             <button
               onClick={() => router.push('/login')}
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
             >
               <ArrowLeft size={14} />
               Back to Login
             </button>
           </div>
         </div>
       </header>
 
       <main className="max-w-7xl mx-auto px-4 py-12">
         {children}
       </main>
 
       <footer className="border-t border-white/5 py-12 mt-20">
         <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8 opacity-40">
           <div className="flex flex-col items-center md:items-start gap-2">
             <span className="text-[10px] font-black uppercase tracking-widest">Seyon Nexa Labs &copy; 2026</span>
             <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--accent)]">Professional Digital Ledger</span>
           </div>
           
           <div className="flex gap-8 text-[9px] font-black uppercase tracking-widest">
             <Link href="/legal/terms" className="hover:text-white transition-colors">Terms</Link>
             <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy</Link>
             <Link href="/schemes" className="hover:text-white transition-colors">Schemes</Link>
           </div>
         </div>
       </footer>
     </div>
   )
 }
