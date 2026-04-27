import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disable static export to avoid _document/404 export issues in this setup
  output: 'standalone',
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://meeting.soict.io';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.resolve.alias = { ...config.resolve.alias, canvas: false };
      // react-pdf / pdf.js: cháº¿ Ä‘á»™ devtool dÃ¹ng eval (máº·c Ä‘á»‹nh cá»§a Next dev) gÃ¢y lá»—i runtime
      // "Object.defineProperty called on non-object" â€” xem wojtekmaj/react-pdf#2031, webpack#20095
      if (dev) {
        // pdf.mjs + webpack dev: eval/source-map cÃ³ thá»ƒ gÃ¢y "Object.defineProperty called on non-object"
        // (react-pdf#2031). Táº¯t devtool client = máº¥t source map dev nhÆ°ng PDF á»•n Ä‘á»‹nh.
        config.devtool = false;
      }
    }
    return config;
  },
};

export default nextConfig;
