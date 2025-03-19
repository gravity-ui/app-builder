"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.babelPreset = babelPreset;
function babelPreset(config) {
    return [
        require.resolve('./ui-preset'),
        {
            env: {
                modules: false,
                bugfixes: true,
                targets: config.isSsr ? { node: 'current' } : undefined,
            },
            runtime: { version: '^7.26.0' },
            typescript: true,
            react: {
                runtime: config.newJsxTransform ? 'automatic' : 'classic',
            },
        },
    ];
}
