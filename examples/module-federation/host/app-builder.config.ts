import {defineConfig} from '@gravity-ui/app-builder';
import {rspack} from '@rspack/core';

const HOST_NAME = 'host';
const HOST_PORT = 3000;

const REMOTES = {
    mf_products: 'http://localhost:3001/build/mf_products/mf-manifest.json',
    mf_cart: 'http://localhost:3002/build/mf_cart/mf-manifest.json',
    mf_profile: 'http://localhost:3003/build/mf_profile/mf-manifest.json',
};

export default defineConfig({
    target: 'client',
    client: {
        bundler: 'rspack',
        devServer: {
            port: HOST_PORT,
            writeToDisk: (target) => target.endsWith('index.html'),
        },
        moduleFederation: {
            name: HOST_NAME,
            originalRemotes: Object.fromEntries(
                Object.entries(REMOTES).map(([name, url]) => [name, `${name}@${url}`]),
            ),
            shared: {
                react: {singleton: true, requiredVersion: false, eager: true},
                'react-dom': {singleton: true, requiredVersion: false, eager: true},
                'react-router': {singleton: true, requiredVersion: false, eager: true},
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
                    publicPath: `/build/${HOST_NAME}/`,
                }),
            );
            return config;
        },
    },
});
