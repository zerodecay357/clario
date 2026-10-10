import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the IITD Moodle TLS intermediate with server routes (see lib/moodle-tls.ts).
  outputFileTracingIncludes: { "/api/**": ["./certs/**"] },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
