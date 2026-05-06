import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://meeting.soict.io';
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${apiBase}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  turbopack: {
    resolveAlias: {
      canvas: '',
    },
  },
};

export default nextConfig;
