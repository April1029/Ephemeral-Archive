/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@libsql/**',
        'node_modules/@aws-sdk/**',
      ],
    },
  },
};

module.exports = nextConfig;
