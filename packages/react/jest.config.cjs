/** @type {import('esbuild').TransformOptions} */
const esbuildOptions = {
  target: "ES2022",
};

/** @type {import('jest').Config} */
const config = {
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  collectCoverageFrom: ["./src/**"],
  coverageProvider: "v8", // v8 is needed for coverage to work with esbuild
  transform: {
    "^.+\\.(t|j)sx?$": ["jest-esbuild", esbuildOptions],
  },
  // src/fobx.ts and src/index.ts are just barrel exports
  coveragePathIgnorePatterns: ["src/index.ts"],
};
module.exports = config;
