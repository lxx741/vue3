import { createRequire } from "module";
import { resolve } from "path";
import jsonPlugin from "@rollup/plugin-json";
import resolvePlugin from "@rollup/plugin-node-resolve";
import tsPlugin from "rollup-plugin-typescript2";

const require = createRequire(import.meta.url);
let target = process.env.TARGET;
let targetPath = resolve(`packages/${target}`);
let targetPkgJSON = require(`${targetPath}/package.json`);
let buildOps = targetPkgJSON.buildOptions;

export default {
  input: `${targetPath}/src/index.ts`,
  output: buildOps.formats.map((format) => ({
    sourcemap: true,
    name: `${buildOps.name}`,
    file: `${targetPath}/dist/${target}.${format}.js`,
    format,
  })),
  plugins: [
    jsonPlugin(),
    tsPlugin({
      tsconfig: resolve("tsconfig.json"),
    }),
    resolvePlugin(),
  ],
};
