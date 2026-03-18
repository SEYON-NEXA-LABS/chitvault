/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow building even with TypeScript errors during development
  typescript: { ignoreBuildErrors: false },
  eslint:     { ignoreDuringBuilds: false },
}

module.exports = nextConfig
