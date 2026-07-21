import type {ServiceConfig} from '@gravity-ui/app-builder';

import {
    APP_ASSETS_MANIFEST_FILE,
    APP_OUTPUT_PATH,
    APP_PORT,
    APP_PUBLIC_PATH,
} from './src/server/config/app-builder';

export default (): ServiceConfig => {
    return {
        client: {
            assetsManifestFile: APP_ASSETS_MANIFEST_FILE,
            devServer: {
                port: APP_PORT ? APP_PORT + 1 : undefined,
            },
            newJsxTransform: true,
            outputPath: APP_OUTPUT_PATH,
            publicPath: APP_PUBLIC_PATH,
        },
        server: {
            port: APP_PORT,
        },
    };
};
