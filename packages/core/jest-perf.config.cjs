const config = require("./jest.config.cjs");

module.exports = { ...config, testPathIgnorePatterns: ["./__tests__/tsc", "./__tests__/mobx-compat", "./src"] };
