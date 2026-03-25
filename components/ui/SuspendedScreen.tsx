'use client'

import type { Firm } from '@/types'

export default function SuspendedScreen({ firm }: { firm: Firm }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0d0f14' }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⏸️</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f66d7a', marginBottom: 10 }}>Account Suspended</h1>
        <p style={{ fontSize: 15, color: '#8892aa', lineHeight: 1.7, marginBottom: 24 }}>
          Your ChitVault account for <strong style={{ color: '#e8ecf5' }}>{firm.name}</strong> has been suspended.
          This usually happens when a renewal invoice is overdue.
        </p>
        <div style={{ background: '#161921', border: '1px solid #2a3045', borderRadius: 12, padding: '20px 24px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 13, color: '#8892aa', lineHeight: 2 }}>
            <div>📞 Contact us to renew your subscription</div>
            <div>💳 Annual plan: ₹2,000 (Basic) or ₹5,000 (Pro)</div>
            <div>✅ Account reactivated immediately on payment</div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: '#505a70' }}>
          Contact: <a href="mailto:billing@chitvault.app" style={{ color: '#2563eb' }}>billing@chitvault.app</a>
        </p>
        <p style={{ fontSize: 12, color: '#505a70', marginTop: 8 }}>Your data is safe and will be restored on reactivation.</p>
      </div>
    </div>
  )
}
