/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    dangerouslyAllowSVG: true,
  },
  // Tesseract.js spawns its own worker threads and loads wasm/training data
  // from disk at runtime. Webpack bundling breaks its internal worker path
  // resolution on Windows, so we tell Next.js not to bundle it server-side.
  experimental: {
    serverComponentsExternalPackages: ['tesseract.js'],
  },
}

module.exports = nextConfig
