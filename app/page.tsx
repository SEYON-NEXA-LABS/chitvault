import { redirect } from 'next/navigation'
// No public landing page — redirect straight to login
export default function RootPage() {
  redirect('/login')
}
