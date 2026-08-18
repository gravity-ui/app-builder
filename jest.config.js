/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
    verbose: true,
    moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    rootDir: '.',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {useESM: true, tsconfig: './tsconfig.jest.json'}],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    coverageDirectory: './coverage',
    collectCoverageFrom: ['src/**/*.{ts,tsx}'],
    passWithNoTests: true,
};

export default config;
