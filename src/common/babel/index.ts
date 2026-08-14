import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

interface BabelPresetConfig {
    isSsr?: boolean;
}

export function babelPreset(config: BabelPresetConfig) {
    return [
        require.resolve('./ui-preset.js'),
        {
            env: {
                targets: config.isSsr ? {node: 'current'} : undefined,
                useBuiltIns: 'usage',
                corejs: '3.44',
                modules: false,
                bugfixes: true,
                shippedProposals: true,
            },
            runtime: {version: '^7.26.0'},
            typescript: true,
            react: {runtime: 'automatic'},
        },
    ];
}

/**
 * Library consumers are responsible for choosing their supported runtimes and
 * applying polyfills at the application boundary. Keep published library code
 * modern and only strip TypeScript syntax and transform JSX here.
 *
 * @returns Babel preset configuration for published library files.
 */
export function libraryBabelPreset() {
    return [
        require.resolve('./ui-preset.js'),
        {
            env: false,
            runtime: false,
            typescript: true,
            react: {runtime: 'automatic'},
        },
    ];
}
