import path from "node:path";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  turbopack: {
    root: path.resolve(".")
  }
};

export default config;
