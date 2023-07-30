module.exports = {
    verbose: true,
    moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
    rootDir: '.',
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.production.json',
            },
        ],
    },
    transformIgnorePatterns: ['node_modules/(?!(@gravity-ui)/)'],
    coverageDirectory: './coverage',
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/__stories__/**/*', '!**/*/*.stories.{ts,tsx}'],
    passWithNoTests: true,
};
