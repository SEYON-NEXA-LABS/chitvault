import { redirect } from 'next/navigation'
// No public landing page — redirect straight to dashboard
// The dashboard layout will handle auth/onboarding redirection if needed.
export default function RootPage() {
  redirect('/dashboard')
}
