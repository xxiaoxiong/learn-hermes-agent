import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://127.0.0.1:3099", "http://localhost:3099"],
};

export default withNextIntl(nextConfig);
