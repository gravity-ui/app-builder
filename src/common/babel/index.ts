export function babelPreset(config: {newJsxTransform?: boolean}) {
    return [
        require.resolve('./ui-preset'),
        {
            env: {modules: false, bugfixes: true},
            runtime: {version: '^7.13.10'},
            typescript: true,
            react: {
                runtime: config.newJsxTransform ? 'automatic' : 'classic',
            },
        },
    ];
}
