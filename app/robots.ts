import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chitvault.in'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/start-trial',
          '/plans',
          '/login',
          '/legal/terms',
          '/legal/privacy',
          '/schemes'
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/superadmin/',
          '/groups/',
          '/members/',
          '/collection/',
          '/auctions/',
          '/cashbook/',
          '/defaulters/',
          '/reports/',
          '/settings/',
          '/team/',
          '/trash/',
          '/onboarding/',
          '/invite/'
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
