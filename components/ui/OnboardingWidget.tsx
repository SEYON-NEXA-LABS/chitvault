'use client'

import { CheckCircle2, Circle, PartyPopper, ArrowRight, PlayCircle } from 'lucide-react'
import { Card, Btn, useTour } from './index'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface OnboardingStep {
  id: string
  title: string
  desc: string
  link: string
  completed: boolean
}

export function OnboardingWidget({ steps }: { steps: OnboardingStep[] }) {
  const { startTour } = useTour()
  const completedCount = steps.filter(s => s.completed).length
  const total = steps.length
  const pct = Math.round((completedCount / total) * 100)
  const allDone = completedCount === total

  const DASHBOARD_TOUR = [
    { target: '#tour-welcome', title: 'Modernized Citadel', content: "Welcome to the new ChitVault Core. We've overhauled the interface for maximum speed and financial clarity.", nextLabel: 'Initiate Link' },
    { target: '#tour-stats', title: 'Real-Time Intelligence', content: "Track your firm's pulse with live metrics. From daily collections to critical defaulter alerts, everything is one click away.", nextLabel: 'Analyze Trends' },
    { target: '#tour-analytics', title: 'Visual Financials', content: "Identify trends at a glance. Our high-fidelity charts help you predict capital flow and group distribution.", nextLabel: 'Master Control' },
    { target: '#tour-sidebar', title: 'Command Center', content: "The new Sidebar is your cockpit. Use Ctrl+K from anywhere to teleport between modules instantly.", nextLabel: 'Finish Protocol' },
  ]

  const handleStartTour = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startTour(DASHBOARD_TOUR)
  }

  if (allDone && pct === 100) {
     return (
       <Card className="p-6 bg-gradient-to-br from-[var(--success-dim)] to-transparent border-[var(--success)] shadow-lg overflow-hidden relative group">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <PartyPopper size={120} />
          </div>
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-[var(--success)] flex items-center justify-center text-white">
                <CheckCircle2 size={24} />
             </div>
             <div className="flex-1">
                <h3 className="font-black text-lg text-[var(--success)]">You&apos;re All Set!</h3>
                <p className="text-sm opacity-60">Your firm setup is complete. You&apos;re now running at full capacity.</p>
                <div className="mt-4">
                  <Btn size="sm" variant="primary" onClick={handleStartTour} className="bg-[var(--success)] border-none shadow-[0_4px_12px_var(--success-dim)]">
                    <PlayCircle size={12} className="mr-1.5" /> Launch Visual Tour
                  </Btn>
                </div>
             </div>
          </div>
       </Card>
     )
  }

  return (
    <Card className="overflow-hidden border-2 border-[var(--accent-border)] bg-[var(--surface)]">
      <div className="px-5 py-4 bg-[var(--accent-dim)] border-b border-[var(--accent-border)] flex items-center justify-between">
        <div>
          <h3 className="font-black text-base text-[var(--accent)] uppercase tracking-wider">Setup Progress</h3>
          <p className="text-[10px] font-bold opacity-60 uppercase">Complete these steps to maximize your platform value</p>
        </div>
        <div className="text-right">
           <div className="text-xl font-black text-[var(--accent)]">{pct}%</div>
           <div className="text-[9px] font-bold opacity-40 uppercase">Done</div>
        </div>
      </div>
      
      <div className="p-2 space-y-1">
        {steps.map((step) => (
          <Link key={step.id} href={step.link} className="block group">
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all border",
              step.completed 
                ? "bg-[var(--surface2)] border-transparent opacity-50" 
                : "bg-[var(--surface)] border-transparent hover:border-[var(--accent-border)] hover:translate-x-1"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors",
                step.completed 
                  ? "bg-[var(--success)] border-[var(--success)] text-white" 
                  : "border-[var(--border)] group-hover:border-[var(--accent)]"
              )}>
                {step.completed ? <CheckCircle2 size={14} /> : <Circle size={10} className="fill-current opacity-0 group-hover:opacity-20" />}
              </div>
              <div className="flex-1">
                <div className={cn("text-xs font-bold", step.completed && "line-through opacity-60")}>{step.title}</div>
                <div className="text-[10px] opacity-40 truncate max-w-[200px]">{step.desc}</div>
              </div>
              {!step.completed && <ArrowRight size={12} className="opacity-0 group-hover:opacity-40 -translate-x-2 group-hover:translate-x-0 transition-all" />}
            </div>
          </Link>
        ))}
      </div>

      <div className="p-4 bg-[var(--surface2)] border-t border-[var(--border)]">
        <Btn size="sm" variant="secondary" onClick={handleStartTour} className="w-full">
           <PlayCircle size={14} className="mr-2" />
           Launch Guided Visual Tour
        </Btn>
      </div>
    </Card>
  )
}
