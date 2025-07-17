export function babelPreset(config: {newJsxTransform?: boolean; isSsr?: boolean}) {
    return [
        require.resolve('./ui-preset'),
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
            react: {
                runtime: config.newJsxTransform ? 'automatic' : 'classic',
            },
        },
    ];
}
