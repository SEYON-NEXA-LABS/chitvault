import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: 'chitvault-pwa',
    name: process.env.NEXT_PUBLIC_APP_NAME || 'SEYON ChitVault — Auction Chit Fund',
    short_name: 'ChitVault',
    description: 'Premium Auction Chit Fund Management Software by Seyon Nexa Labs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#2563eb',
    orientation: 'portrait',
    categories: ['finance', 'business'],
    icons: [
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
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        url: '/dashboard',
        icons: [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
      },
      {
        name: 'Members',
        url: '/members',
        icons: [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
      }
    ]
  }
}
