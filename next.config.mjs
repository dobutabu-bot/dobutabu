/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    middlewareClientMaxBodySize: "25mb"
  }
};

export default nextConfig;
