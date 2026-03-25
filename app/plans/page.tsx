'use client'

import { Card, Btn, Badge } from '@/components/ui'
import { Check } from 'lucide-react'

const FEATURES = {
  core: [
    'Group Management',
    'Member Management',
    'Auction Management',
    'Payment Collections',
    'Basic Reporting',
  ],
  pro: [
    'Advanced Collection Reports',
    'Staff Management & Roles',
    'Branding & Appearance',
    'Perpetual License Option',
    'Priority Support',
  ]
}

export default function PlansPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Subscription Plans</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text2)' }}>
          Choose the plan that fits your firm’s needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Basic Plan */}
        <Card className="p-8 flex flex-col h-full">
          <h3 className="text-xl font-semibold">Basic Plan</h3>
          <p className="text-sm mt-2 flex-grow" style={{ color: 'var(--text2)' }}>
            All the essentials to manage your chit fund business efficiently.
          </p>
          <ul className="space-y-3 text-sm my-8">
            {FEATURES.core.map(feature => (
              <li key={feature} className="flex items-center gap-3">
                <Check size={16} style={{ color: 'var(--green)' }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Btn variant="secondary" className="mt-auto w-full" disabled>Basic Plan</Btn>
        </Card>

        {/* Pro Plan */}
        <Card className="p-8 flex flex-col h-full border-2 relative" style={{ borderColor: 'var(--gold)' }}>
           <Badge variant="gold" className="absolute -top-3 right-6">Recommended</Badge>
          <h3 className="text-xl font-semibold">Pro Plan</h3>
          <p className="text-sm mt-2 flex-grow" style={{ color: 'var(--text2)' }}>
            Unlock powerful reporting, staff management, and advanced features.
          </p>
          <ul className="space-y-3 text-sm my-8">
            {FEATURES.core.map(feature => (
              <li key={feature} className="flex items-center gap-3">
                <Check size={16} style={{ color: 'var(--green)' }} />
                <span>{feature}</span>
              </li>
            ))}
            {FEATURES.pro.map(feature => (
              <li key={feature} className="flex items-center gap-3">
                <Check size={16} style={{ color: 'var(--gold)' }} />
                <span className="font-semibold">{feature}</span>
              </li>
            ))}
          </ul>
          <Btn variant="primary" className="mt-auto w-full" disabled>Pro Plan</Btn>
        </Card>
      </div>
       <div className="text-center mt-10">
         <p className="text-xs" style={{color: 'var(--text3)' }}>
            Subscription plan management is handled by the administrator.
         </p>
       </div>
    </div>
  )
}
