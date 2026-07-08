import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfkit nicht bundeln — es lädt seine Font-Dateien (.afm) zur Laufzeit aus node_modules
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
