import type { NextConfig } from 'next';

const githubPagesBasePath = process.env.GITHUB_ACTIONS === 'true' ? '/contrata-hogar' : '';

const nextConfig: NextConfig = {
  // Both Cloudflare Pages and GitHub Pages serve the browser application as
  // static assets. GitHub Pages publishes project sites under the repository
  // name, so its build needs an explicit base path.
  output: 'export',
  basePath: githubPagesBasePath,
  assetPrefix: githubPagesBasePath,
};

export default nextConfig;
