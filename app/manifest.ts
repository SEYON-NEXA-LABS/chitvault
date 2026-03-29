import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { APP_NAME } from '@/lib/utils'
import { THEMES } from '@/lib/branding/themes'

export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const supabase = createClient()

  // Try to get current user to identify their firm

  let name = process.env.NEXT_PUBLIC_APP_NAME || 'Seyon Chit Vault'
  let shortName = 'ChitVault'
  let description = 'Auction Chit Fund Management'
  let startUrl = '/'
  let theme_id = 'theme1'
  let iconUrl = '/icons/icon-512.png'
  let bg = '#ffffff'

  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // 1. Find profile
      const { data: prof } = await supabase
        .from('profiles').select('firm_id').eq('id', user.id).maybeSingle()

      if (prof?.firm_id) {
        // 2. Load firm branding
        const { data: firm } = await supabase
          .from('firms').select('name, theme_id, logo_url, tagline').eq('id', prof.firm_id).maybeSingle()

        if (firm) {
          name = firm.name
          shortName = firm.name.split(' ')[0]
          description = firm.tagline || `${firm.name} Management`
          theme_id = firm.theme_id || 'theme1'
          startUrl = '/dashboard'
          if (firm.logo_url) iconUrl = firm.logo_url
        }
      }
    }
  } catch (e) {
    console.error('Manifest branding fetch failed:', e)
  }

  const themeVars = THEMES.find(t => t.id === theme_id) || THEMES[0]

  return {
    id: 'chitvault-pwa',
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    display: 'standalone',
    background_color: themeVars.bg || '#ffffff',
    theme_color: themeVars.primary,
    icons: [
      {
        src: iconUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
  }
}
