import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloudflare Pages serves the browser application as static assets. The
  // app's authentication and persistence are client-side Supabase requests.
  output: 'export',
};

export default nextConfig;
