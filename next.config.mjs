/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      // StepStudio SPA fallback — all /stepstudio/* sub-routes serve the static index.html
      // (assets like /stepstudio/assets/*.js are served directly from public/ first)
      {
        source: '/stepstudio/:path((?!assets/).*)',
        destination: '/stepstudio/index.html',
      },
    ];
  },
};

export default nextConfig;
