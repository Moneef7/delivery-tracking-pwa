import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Required for Next.js 16 with Turbopack
  turbopack: {},
};

export default withPWA(nextConfig);
