/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure JSON imports work
  webpack: (config) => {
    config.resolve.extensions.push('.json');

    // MetaMask SDK references this optional RN dependency; it is not needed on web.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@react-native-async-storage/async-storage': false,
    };

    return config;
  },
};

module.exports = nextConfig;
