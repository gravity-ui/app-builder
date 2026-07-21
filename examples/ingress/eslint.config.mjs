import baseConfig from '@gravity-ui/eslint-config/base';
import clientConfig from '@gravity-ui/eslint-config/client';
import importOrderConfig from '@gravity-ui/eslint-config/import-order';
import serverConfig from '@gravity-ui/eslint-config/server';
import typescriptConfig from '@gravity-ui/eslint-config/typescript';
import {defineConfig} from 'eslint/config';
import globals from 'globals';

export default defineConfig(
    baseConfig,
    importOrderConfig,
    {
        files: [
            '.prettierrc.js',
            'app-builder.config.ts',
        ],
        languageOptions: {
            globals: {
                ...globals.node,
            }
        }
    },
    typescriptConfig,
    {
        files: ['./src/server/**/*'],
        extends: [serverConfig],
    },
    {
        files: ['./src/ui/**/*'],
        extends: [clientConfig],
        rules: {
            'react/jsx-uses-react': 'off',
            'react/react-in-jsx-scope': 'off',
        },
    },
);