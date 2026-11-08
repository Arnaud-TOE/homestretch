import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Bryntum checks its license key in the browser, so the key ships in the page like any client-side key.
  env: { BRYNTUM_LICENSE_KEY: process.env.BRYNTUM_LICENSE_KEY ?? process.env.NEXT_PUBLIC_BRYNTUM_LICENSE_KEY ?? '' },
};

export default nextConfig;
