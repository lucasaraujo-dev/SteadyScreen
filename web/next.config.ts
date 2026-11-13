import type { NextConfig } from "next";

// In development the Go server runs apart (port 8080). Sending /api through
// the site keeps the login cookie on the site's own address, like production
// (where nginx does this job).
const devServer = process.env.DEV_SERVER_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // Small self-contained build for the Docker image (deploy/).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/api/:path*", destination: `${devServer}/api/:path*` }];
  },
};

export default nextConfig;
