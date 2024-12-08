export function babelPreset(config: {newJsxTransform?: boolean; isSsr?: boolean}) {
    return [
        require.resolve('./ui-preset'),
        {
            env: {
                modules: false,
                bugfixes: true,
                targets: config.isSsr ? {node: 'current'} : undefined,
            },
            runtime: {version: '^7.13.10'},
            typescript: true,
            react: {
                runtime: config.newJsxTransform ? 'automatic' : 'classic',
            },
        },
    ];
}
