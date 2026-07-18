import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com'
      }
    ]
  },
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/prisma/build/public/assets/inter-all-400-normal.4c1f8a0d.woff',
      './node_modules/prisma/build/public/assets/inter-all-600-normal.d0a7c8a9.woff'
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '160mb'
    }
  }
};

export default nextConfig;
