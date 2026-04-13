/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Ensure JSON imports work
  webpack: (config) => {
    config.resolve.extensions.push('.json');
    return config;
  },
};

module.exports = nextConfig;
