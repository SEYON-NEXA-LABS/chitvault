import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { APP_NAME } from '@/lib/utils'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const supabase = createClient()
  
  // Try to get current user to identify their firm
  const { data: { user } } = await supabase.auth.getUser()
  
  let name        = process.env.NEXT_PUBLIC_APP_NAME || 'Seyon Chit Vault'
  let shortName   = 'ChitVault'
  let description = 'Auction Chit Fund Management'
  let startUrl    = '/'
  let color       = '#2563eb'
  let bg          = '#ffffff'
  let iconUrl     = '/icons/icon-512.png'

  if (user) {
    // 1. Find profile
    const { data: prof } = await supabase
      .from('profiles').select('firm_id').eq('id', user.id).maybeSingle()
    
    if (prof?.firm_id) {
       // 2. Load firm branding
       const { data: firm } = await supabase
         .from('firms').select('*').eq('id', prof.firm_id).maybeSingle()
       
       if (firm) {
          name        = firm.name
          shortName   = firm.name.split(' ')[0]
          description = firm.tagline || `${firm.name} Management`
          color       = firm.primary_color || color
          startUrl    = '/dashboard'
          if (firm.logo_url) iconUrl = firm.logo_url
       }
    }
  }

  return {
    name,
    short_name: shortName,
    description,
    start_url:  startUrl,
    display:    'standalone',
    background_color: bg,
    theme_color:      color,
    icons: [
      {
        src: iconUrl,
        sizes: 'any',
        type: 'image/png',
      },
      {
         src: '/icons/icon-192.png',
         sizes: '192x192',
         type: 'image/png'
      },
      {
         src: '/icons/icon-512.png',
         sizes: '512x512',
         type: 'image/png'
      }
    ],
  }
}
