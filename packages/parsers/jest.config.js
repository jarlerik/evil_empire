module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^../src$': '<rootDir>/src/index.ts',
    '^../src/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        moduleResolution: 'node',
        module: 'commonjs',
        target: 'ES2022'
      }
    }]
  }
};
