/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // Fix for private class fields in dependencies
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'undici': false,
      };
    }
    return config;
  },
}

module.exports = nextConfig 