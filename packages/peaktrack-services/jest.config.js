module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@evil-empire/parsers$': '<rootDir>/../parsers/src',
    '^@evil-empire/types$': '<rootDir>/../types/src',
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
