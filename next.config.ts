import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["endeavour.n.vpn", "10.7.14.202", "munchbase.h.frcv.net"],
};

export default nextConfig;
