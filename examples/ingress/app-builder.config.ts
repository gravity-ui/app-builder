import type {ServiceConfig} from '@gravity-ui/app-builder';

import {APP_PORT} from './src/server/config/app-builder';

export default (): ServiceConfig => {
    return {
        client: {
            newJsxTransform: true,
            devServer: {
                port: APP_PORT ? APP_PORT + 1 : undefined,
            },
        },
        server: {
            port: APP_PORT,
        },
    };
};
