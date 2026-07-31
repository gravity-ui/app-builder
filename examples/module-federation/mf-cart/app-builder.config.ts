import {defineConfig} from '@gravity-ui/app-builder';
import {rspack} from '@rspack/core';

const MF_NAME = 'mf_cart';
const PORT = 3002;

export default defineConfig({
    target: 'client',
    client: {
        bundler: 'rspack',
        devServer: {
            port: PORT,
            writeToDisk: (target) => target.endsWith('index.html'),
        },
        moduleFederation: {
            name: MF_NAME,
            exposes: {
                './App': './src/ui/App',
            },
            shared: {
                react: {singleton: true, requiredVersion: false},
                'react-dom': {singleton: true, requiredVersion: false},
                'react-router': {singleton: true, requiredVersion: false},
            },
        },
        rspack: (config) => {
            config.plugins = config.plugins ?? [];
            config.plugins.push(
                new rspack.HtmlRspackPlugin({
                    filename: '../../index.html',
                    template: 'public/index.html',
                    inject: 'body',
                    scriptLoading: 'defer',
                    publicPath: `/build/${MF_NAME}/`,
                }),
            );
            return config;
        },
    },
});
