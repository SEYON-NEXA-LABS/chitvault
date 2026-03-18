/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Electron packaging — bundles Next.js as a standalone server
  output: process.env.ELECTRON_BUILD === '1' ? 'standalone' : undefined,
}
module.exports = nextConfig
