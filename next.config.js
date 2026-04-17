/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@libsql/client', '@aws-sdk/client-s3'],
};

module.exports = nextConfig;
