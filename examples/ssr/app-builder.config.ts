import {defineConfig} from '@gravity-ui/app-builder';

export default defineConfig(() => {
    return {
        client: {
            devServer: {
                port: true,
            },
            ssr: {
                noExternal: [/@gravity-ui\/.+/, /lodash/],
                moduleType: 'esm',
            },
        },
        server: {
            port: true,
        },
    };
});
