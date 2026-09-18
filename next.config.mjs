/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === "true";

const nextConfig = {
  output: staticExport ? "export" : undefined,
  trailingSlash: staticExport,
};

export default nextConfig;
