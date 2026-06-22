import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  scope: "/",
  register: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV !== "production",
  injectionPoint: "self.__MUNCHBASE_MANIFEST",
});

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  allowedDevOrigins: ["endeavour.n.vpn", "10.7.14.202", "munchbase.h.frcv.net", "munchbase.n.frcv.net"],
  headers: async () => [
    {
      source: "/icons/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/manifest.json",
      headers: [
        { key: "Content-Type", value: "application/manifest+json" },
        { key: "Cache-Control", value: "public, max-age=3600" },
      ],
    },
    {
      source: "/favicon.svg",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache" },
      ],
    },
  ],
};

export default withSerwist(nextConfig);
