// @ts-check
import * as esbuild from "esbuild";
import * as fs from "node:fs/promises";
import * as zlib from "node:zlib";

function gzip(input, options) {
  const promise = new Promise((resolve, reject) => {
    zlib.gzip(input, options, (error, result) => {
      if (!error) resolve(result);
      else reject(error);
    });
  });
  return promise;
}

const NAME = "index";
const DIR = "./dist";
const ESM_EXT = ".js";
const CJS_EXT = ".cjs";

// make sure dist folder doesn't contain anything out of date
await fs.rm(DIR, { recursive: true, force: true });
await fs.mkdir(DIR);

const writeBundle = (extension) => {
  const format = extension === ESM_EXT ? "esm" : "cjs";

  return esbuild.build({
    entryPoints: ["./src/index.ts"],
    bundle: true,
    format,
    define: {
      // TODO: we want the following define for NODE_ENV for bundles that target consumers using bundlers
      // TODO: we would want these to be true/false for non-bundler consumers (true for develop build, false for production)
      // makes string persist in final bundle instead of replacing with environment variable value
      "process.env.NODE_ENV": '"production"',
    },
    external: ["@fobx/core", "react"],
    minify: false,
    outfile: `${DIR}/${NAME}${extension}`,
  });
};

await Promise.all([writeBundle(ESM_EXT), writeBundle(CJS_EXT)]).catch((e) => {
  console.error(e);
  process.exit(1);
});

// print out size info
const path = `${DIR}/${NAME}${ESM_EXT}`;
const buffer = await fs.readFile(path);
const gz = await gzip(buffer);
console.log(`size [gzip]: ${(buffer.byteLength / 1024).toFixed(2)}kb [${(gz.byteLength / 1024).toFixed(2)}kb]`);
