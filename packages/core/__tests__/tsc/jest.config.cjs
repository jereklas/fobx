/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // [...]
  transform: {
    // '^.+\\.[tj]sx?$' to process js/ts with `ts-jest`
    // '^.+\\.m?[tj]sx?$' to process js/ts/mjs/mts with `ts-jest`
    "^.+\\.(ts|js)x?$": [
      "ts-jest",
      {
        diagnostics: false,
        tsconfig: `${__dirname}/tsconfig.json`,
      },
    ],
  },
};
