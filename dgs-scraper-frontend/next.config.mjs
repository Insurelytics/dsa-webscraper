/** @type {import('next').NextConfig} */
const BASE_PATH = process.env.BASE_PATH;

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  ...(BASE_PATH ? { basePath: BASE_PATH.startsWith('/') ? BASE_PATH : `/${BASE_PATH}` } : {}),
}

export default nextConfig
