import baseConfig from '@gravity-ui/eslint-config/base';
import importOrderConfig from '@gravity-ui/eslint-config/import-order';
import typescriptConfig from '@gravity-ui/eslint-config/typescript';
import {defineConfig} from 'eslint/config';
import globals from 'globals';

export default defineConfig(
    {ignores: ['build/**']},
    baseConfig,
    importOrderConfig,
    {
        files: ['.prettierrc.cjs', 'src/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    typescriptConfig,
);
