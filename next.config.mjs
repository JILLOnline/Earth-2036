/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === "true";

const rawBasePath = (process.env.EARTH2036_BASE_PATH ?? "").trim();
const basePath =
  rawBasePath && rawBasePath !== "/"
    ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}`
    : "";

const nextConfig = {
  output: staticExport ? "export" : undefined,
  basePath,
  trailingSlash: staticExport,
};

export default nextConfig;
