import type { NextConfig } from 'next';

// Same-origin API proxy. Auth cookie is httpOnly and never handled in client JS.
// Override API_PROXY_TARGET if Express is on another internal host.
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000'}/api/:path*` }];
  },
};
export default nextConfig;
