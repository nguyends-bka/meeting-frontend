import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disable static export to avoid _document/404 export issues in this setup
  output: undefined,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
