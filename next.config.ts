import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disable static export to avoid _document/404 export issues in this setup
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.resolve.alias = { ...config.resolve.alias, canvas: false };
      // react-pdf / pdf.js: chế độ devtool dùng eval (mặc định của Next dev) gây lỗi runtime
      // "Object.defineProperty called on non-object" — xem wojtekmaj/react-pdf#2031, webpack#20095
      if (dev) {
        // pdf.mjs + webpack dev: eval/source-map có thể gây "Object.defineProperty called on non-object"
        // (react-pdf#2031). Tắt devtool client = mất source map dev nhưng PDF ổn định.
        config.devtool = false;
      }
    }
    return config;
  },
};

export default nextConfig;
