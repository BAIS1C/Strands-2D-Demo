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
    return {
      beforeFiles: [
        // StepStudio SPA — /stepstudio/app, /stepstudio/login etc. all serve index.html
        // Static assets (/stepstudio/assets/*) are matched by filesystem first via afterFiles
        {
          source: '/stepstudio/app',
          destination: '/stepstudio/index.html',
        },
        {
          source: '/stepstudio/app/:path*',
          destination: '/stepstudio/index.html',
        },
        {
          source: '/stepstudio/login',
          destination: '/stepstudio/index.html',
        },
        {
          source: '/stepstudio/signup',
          destination: '/stepstudio/index.html',
        },
        {
          source: '/stepstudio/song/:path*',
          destination: '/stepstudio/index.html',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
