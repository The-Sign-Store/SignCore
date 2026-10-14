/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg'],
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};
export default nextConfig;
