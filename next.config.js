/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'fluent-ffmpeg'];
    return config;
  },
};

module.exports = nextConfig;
