/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/app.plugin.test.js',
    '<rootDir>/nativeSdkVersions.test.js',
  ],
  transform: {
    '^.+\\.(ts|tsx|js)$': '@swc/jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(@faker-js)/)'],
};
