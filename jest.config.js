/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
    verbose: true,
    moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
    rootDir: '.',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {tsconfig: './tsconfig.jest.json'}],
    },
    coverageDirectory: './coverage',
    collectCoverageFrom: ['src/**/*.{ts,tsx}'],
    passWithNoTests: true,
};

module.exports = config;
