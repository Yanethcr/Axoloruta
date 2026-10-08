import type { NextConfig } from 'next';

// Un solo puerto público (3000): Next reenvía /api/* al backend NestJS.
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/api/:path*` }];
  },
};

export default nextConfig;
