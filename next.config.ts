import type { NextConfig } from 'next';

// The application uses API routes and Cloudflare D1, so it must run as a
// Worker rather than as a static GitHub Pages export.
const nextConfig: NextConfig = {};

export default nextConfig;
