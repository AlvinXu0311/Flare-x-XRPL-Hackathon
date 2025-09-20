module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    'models/**/*.js',
    '!node_modules/**',
    '!tests/**'
  ],
  setupFilesAfterEnv: [],
  testTimeout: 10000
};