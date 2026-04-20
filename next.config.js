const { execSync } = require('child_process');

let commitId = 'dev';
try {
  commitId = execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim();
} catch (e) {
  // Use a stable version fallback for managed hosting where .git may be missing
  commitId = 'v1.0.1';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Electron packaging — bundles Next.js as a standalone server
  output: process.env.ELECTRON_BUILD === '1' ? 'standalone' : undefined,
  env: {
    NEXT_PUBLIC_COMMIT_ID: commitId,
  },

  // Prevent stale HTML cache after deployments (Hostinger/CDN fix)
  async headers() {
    return [
      {
        // HTML pages — always revalidate with server, but allow local caching
        source: '/((?!_next/static|_next/image|icons|favicon.ico|manifest.json).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // Static assets — Long-lived cache
        source: '/(icons|fonts|manifest.json|favicon.ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
