import {defineConfig} from '@gravity-ui/app-builder';

export default defineConfig(() => {
    return {
        client: {
            bundler: 'rspack',
            transformCssWithLightningCss: true,
            devServer: {
                port: true,
            },
            ssr: {
                noExternal: [/@gravity-ui\/.+/], // dependencies with ccs imports in sources or not correct esm modules should be bundled.
                moduleType: 'esm', // default commonjs
            },
        },
        server: {
            port: true,
            compiler: 'swc',
        },
    };
});
