import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

// Version stamp: the commit date and hash of the build, surfaced in the user menu.
// Docker builds pass MUNCHBASE_COMMIT/MUNCHBASE_COMMIT_DATE as build args because
// .dockerignore keeps .git out of the build context; local builds read git directly.
function gitOutput(args: string[]) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const appCommit = process.env.MUNCHBASE_COMMIT?.trim() || gitOutput(["rev-parse", "HEAD"]);
const appCommitDate = process.env.MUNCHBASE_COMMIT_DATE?.trim() || gitOutput(["log", "-1", "--format=%cs"]);

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
  env: {
    NEXT_PUBLIC_APP_VERSION: appCommitDate,
    NEXT_PUBLIC_APP_COMMIT: appCommit,
  },
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"] },
  turbopack: {},
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
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
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
      ],
    },
  ],
};

export default withSerwist(nextConfig);
