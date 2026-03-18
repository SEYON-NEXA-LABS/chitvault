import Link from 'next/link'

export default function LandingPage() {
  const features = [
    { icon: '🏦', title: 'Group Management', desc: 'Create and manage multiple chit groups with full auction tracking.' },
    { icon: '👥', title: 'Member Profiles', desc: 'Track members across groups, handle ticket transfers and defaulters.' },
    { icon: '🔨', title: 'Auction Recording', desc: 'Record monthly auctions with auto dividend calculation.' },
    { icon: '💳', title: 'Payment Matrix', desc: 'Visual month-by-month payment status for every member.' },
    { icon: '📋', title: 'Collection Report', desc: 'Printable pending list with phone numbers for field collection.' },
    { icon: '☁️', title: 'Cloud & Secure', desc: 'Your data is private, backed up daily, accessible anywhere.' },
  ]
  const plans = [
    { name: 'Trial', price: 'Free', period: '30 days', groups: '2 groups', members: '20 members', color: '#5b8af5' },
    { name: 'Basic', price: '₹2,000', period: '/year', groups: '10 groups', members: '200 members', color: '#c9a84c', popular: true },
    { name: 'Pro', price: '₹5,000', period: '/year', groups: 'Unlimited', members: 'Unlimited', color: '#3ecf8e' },
  ]
  return (
    <div style={{ background: '#0d0f14', minHeight: '100vh', color: '#e8ecf5', fontFamily: 'sans-serif' }}>
      <nav style={{ borderBottom: '1px solid #2a3045', background: '#161921', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, color: '#c9a84c', fontWeight: 700 }}>ChitVault</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login" style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #2a3045', color: '#8892aa', textDecoration: 'none', fontSize: 14 }}>Sign In</Link>
          <Link href="/register" style={{ padding: '8px 18px', borderRadius: 8, background: '#c9a84c', color: '#0d0f14', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Free Trial</Link>
        </div>
      </nav>
      <div style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: 'rgba(201,168,76,0.15)', color: '#c9a84c', borderRadius: 20, padding: '4px 16px', fontSize: 12, fontWeight: 600, marginBottom: 24 }}>
          🏆 Trusted by Chit Fund Businesses
        </div>
        <h1 style={{ fontSize: 'clamp(28px,5vw,52px)', lineHeight: 1.2, marginBottom: 20, fontWeight: 800 }}>
          Manage Your Chit Fund Business<br />
          <span style={{ color: '#c9a84c' }}>Effortlessly in the Cloud</span>
        </h1>
        <p style={{ fontSize: 17, color: '#8892aa', lineHeight: 1.7, marginBottom: 32 }}>
          Record auctions, track payments, generate collection reports — all in one place.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ padding: '14px 32px', background: '#c9a84c', color: '#0d0f14', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>Start Free Trial →</Link>
          <Link href="/login" style={{ padding: '14px 24px', border: '1px solid #2a3045', color: '#8892aa', borderRadius: 10, fontSize: 14, textDecoration: 'none' }}>Sign In</Link>
        </div>
        <p style={{ fontSize: 12, color: '#505a70', marginTop: 12 }}>No credit card • 30-day free trial • Your data stays yours</p>
      </div>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        {features.map(f => (
          <div key={f.title} style={{ background: '#161921', border: '1px solid #2a3045', borderRadius: 12, padding: '22px 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: '#8892aa', lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 80px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Simple Pricing</h2>
        <p style={{ color: '#8892aa', marginBottom: 36, fontSize: 15 }}>We invoice you once a year. Pay by UPI or bank transfer.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {plans.map(p => (
            <div key={p.name} style={{ background: '#161921', border: `2px solid ${(p as any).popular ? p.color : '#2a3045'}`, borderRadius: 14, padding: '28px 22px', position: 'relative' }}>
              {(p as any).popular && <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: p.color, color: '#0d0f14', borderRadius: 20, padding: '2px 12px', fontSize: 11, fontWeight: 700 }}>Most Popular</div>}
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{p.name}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: p.color, lineHeight: 1.2 }}>{p.price}</div>
              <div style={{ fontSize: 12, color: '#505a70', marginBottom: 16 }}>{p.period}</div>
              <div style={{ fontSize: 13, color: '#8892aa', lineHeight: 2, marginBottom: 20 }}>✓ {p.groups}<br/>✓ {p.members}<br/>✓ All features</div>
              <Link href="/register" style={{ display: 'block', padding: '10px 0', borderRadius: 8, background: (p as any).popular ? p.color : '#1e2230', color: (p as any).popular ? '#0d0f14' : '#e8ecf5', border: (p as any).popular ? 'none' : '1px solid #2a3045', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Get Started</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
