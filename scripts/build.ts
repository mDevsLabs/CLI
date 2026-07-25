import { build } from "bun";

const ignoreReactDevToolsPlugin = {
  name: "ignore-react-devtools",
  setup(build: any) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: "react-devtools-core",
      namespace: "ignore",
    }));
    build.onLoad({ filter: /.*/, namespace: "ignore" }, () => ({
      contents: "export default {};",
      loader: "js",
    }));
  },
};

const result = await build({
  entrypoints: ["./src/entrypoints/cli.tsx"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  minify: true,
  sourcemap: "external",
  plugins: [ignoreReactDevToolsPlugin],
  external: [
    "@modelcontextprotocol/sdk",
  ],
  naming: {
    entry: "cli.mjs",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

if (!result.success) {
  console.error("❌ Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("✅ Build complete: dist/cli.mjs");
