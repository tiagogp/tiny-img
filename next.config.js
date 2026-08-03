/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Safety net: even if `next/image` is imported later, serve the source URL
  // directly instead of generating `/_next/image` transformations on Vercel.
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
