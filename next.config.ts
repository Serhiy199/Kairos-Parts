import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/prisma/build/public/assets/inter-cyrillic-400-normal.ac97a49e.woff2',
      './node_modules/prisma/build/public/assets/inter-cyrillic-600-normal.2c917f10.woff2'
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb'
    }
  }
};

export default nextConfig;
