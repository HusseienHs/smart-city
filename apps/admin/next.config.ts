import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace packages ship TypeScript source; Next compiles them as part of the app.
  transpilePackages: ['@smart-city/api', '@smart-city/shared'],
  poweredByHeader: false,
  // Lets the dev server's hot reload work when the admin is opened from another device on the LAN.
  allowedDevOrigins: ['192.168.1.195'],
  experimental: {
    serverActions: {
      // Announcement images (up to 5 MB) are sent with the form; leave room for multipart overhead.
      bodySizeLimit: '6mb',
    },
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
