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
    const studioUrl = process.env.SOUNDWAVE_STUDIO_URL; // e.g. https://soundwave.strandsnation.xyz
    const apiUrl = process.env.SOUNDWAVE_API_URL;       // e.g. https://soundwave-api.strandsnation.xyz

    const rules = [];

    // StepStudio UI — iframe at /stepstudio/ proxies to the full UI tunnel
    if (studioUrl) {
      rules.push({
        source: '/stepstudio/:path*',
        destination: `${studioUrl}/:path*`,
      });
    }

    // Direct API proxy (fallback — the /api/soundwave route handler is preferred)
    if (apiUrl) {
      rules.push({
        source: '/api/soundwave/:path*',
        destination: `${apiUrl}/:path*`,
      });
    }

    return rules;
  },
};

export default nextConfig;
