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
}

module.exports = nextConfig
