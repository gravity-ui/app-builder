import * as path from 'node:path';

import {newNginxIngressListeningHandler} from '@examples/ingress-nginx';
import type {ServiceConfig} from '@gravity-ui/app-builder';

import {
    APP_ASSETS_MANIFEST_FILE,
    APP_OUTPUT_PATH,
    APP_PORT,
    APP_PUBLIC_PATH,
    APP_SOCKET,
} from './src/server/config/app-builder';

export default (): ServiceConfig => {
    return {
        client: {
            assetsManifestFile: APP_ASSETS_MANIFEST_FILE,
            devServer: {
                port: APP_PORT ? APP_PORT + 1 : undefined,
                // Fires once the client dev server is listening — the moment its socket/port
                // (the /build/ upstream) becomes reachable for the reverse tunnel.
                onListening: (devServer) => {
                    const nginxIngress = newNginxIngressListeningHandler({
                        template: path.resolve('templates', 'nginx.conf.template'),
                        serverName: process.env.INGRESS_SERVER_NAME ?? 'ingress.example',
                        remote: {
                            host: process.env.INGRESS_HOST ?? 'me@dev-vm',
                            // /build/ upstream → the client dev server (local end read from onListening).
                            client: {reversePort: 3031},
                            // everything else → the node server on its ipc socket.
                            server: {reversePort: 3030, socket: APP_SOCKET, localPort: APP_PORT},
                        },
                    });

                    nginxIngress.handle(devServer);

                    process.once('SIGINT', nginxIngress.stop);
                    process.once('SIGTERM', nginxIngress.stop);
                },
            },
            newJsxTransform: true,
            outputPath: APP_OUTPUT_PATH ? path.resolve(APP_OUTPUT_PATH) : undefined,
            publicPath: APP_PUBLIC_PATH,
        },
        server: {
            port: APP_PORT,
        },
    };
};
