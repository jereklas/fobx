// @ts-check
// cspell:ignore outfile
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

const NAME = "fobx";
const DIR = "./dist";
const ESM_EXT = ".js";
const CJS_EXT = ".cjs";

// make sure dist folder doesn't contain anything out of date
await fs.rm(DIR, { recursive: true, force: true });
await fs.mkdir(DIR);

// These options would produce the smallest bundle for a scenario where consumer isn't using a bundler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const noConsumerBundlerOptions = {
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  minifySyntax: true,
  minifyWhitespace: true,
};

const baseOptions = {
  target: "ES2022",
  // minify strips out /* @__PURE__ */ annotations. Should only turn if a bundle needs to be
  // produced for a consumer not using a bundler.
  minify: false,
  define: {
    // makes string persist in final bundle instead of evaluating build's environment
    "process.env.NODE_ENV": "process.env.NODE_ENV",
  },
};

const getFormat = (extension) => (ESM_EXT === extension ? "esm" : "cjs");

const writeBundle = (extension, noBundler = false) => {
  const outfile = noBundler ? `${DIR}/${NAME}.prod${extension}` : `${DIR}/${NAME}${extension}`;
  /** @type {esbuild.BuildOptions} */
  let opts = {
    ...baseOptions,
    entryPoints: ["./src/fobx.ts"],
    bundle: true,
    format: getFormat(extension),
    outfile,
  };
  if (noBundler) {
    opts = { ...opts, ...noConsumerBundlerOptions };
  }
  return esbuild.build(opts);
};

/**
 * Writes an entrypoint file for the library (barrel export file)
 * @param {string} name the file name (without extension)
 * @param {string} extension the output extension to build to
 * @returns {Promise<void>} the build results
 */
const writeEntrypoint = async (name, extension) => {
  const results = await esbuild.build({
    entryPoints: [`./src/${name}.ts`],
    format: getFormat(extension),
    outfile: `${DIR}/${name}${extension}`,
    write: false,
    ...baseOptions,
  });
  const { contents, path } = results.outputFiles[0];
  return fs.writeFile(
    path,
    extension === CJS_EXT
      ? String.fromCharCode.apply(null, contents).replace('require("./fobx.js")', 'require("./fobx.cjs")')
      : contents
  );
};

await Promise.all([
  writeBundle(ESM_EXT),
  writeBundle(CJS_EXT),
  writeBundle(ESM_EXT, true),
  writeBundle(CJS_EXT, true),
  writeEntrypoint("index", ESM_EXT),
  writeEntrypoint("index", CJS_EXT),
  writeEntrypoint("decorators", ESM_EXT),
  writeEntrypoint("decorators", CJS_EXT),
]).catch((e) => {
  console.error(e);
  process.exit(1);
});

// print out size info
const path = `${DIR}/${NAME}${ESM_EXT}`;
const buffer = await fs.readFile(path);
const gz = await gzip(buffer);
console.log(`size [gzip]: ${(buffer.byteLength / 1024).toFixed(2)}kb [${(gz.byteLength / 1024).toFixed(2)}kb]`);
