/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json',
      isolatedModules: true
    }],
  },
  testEnvironment: 'jest-environment-node',

  // Setup file to configure test environment (includes File API polyfill)
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],

  // Configure reporters for test results
  reporters: [
    'default',
    ['jest-junit', {outputDirectory: './test/results/', outputName: 'xunit.xml'}],
  ],

  // Automatically clear mock calls and instances between tests
  clearMocks: true,

  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageReporters: ['json', 'text', 'lcov', 'text-summary'],

  // An object that configures minimum threshold enforcement for coverage results
  coverageThreshold: {
    global: {
      statements: 80,
      functions: 80,
      branches: 80,
      lines: 80,
    },
  },

  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/UIAPIServer/handlers.ts', // todo: improve test coverage
  ],

  transformIgnorePatterns: [
    '/node_modules/',
  ],
};
