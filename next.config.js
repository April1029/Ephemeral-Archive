/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@libsql/**',
      'node_modules/@aws-sdk/**',
    ],
  },
};

module.exports = nextConfig;
