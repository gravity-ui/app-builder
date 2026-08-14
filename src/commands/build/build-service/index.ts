import {shouldCompileTarget} from '../../../common/utils.js';

import type {NormalizedServiceConfig} from '../../../common/models/index.js';

export default function (config: NormalizedServiceConfig) {
    const shouldCompileClient = shouldCompileTarget(config.target, 'client');
    const shouldCompileServer = shouldCompileTarget(config.target, 'server');

    const compilations: Promise<void>[] = [];
    if (shouldCompileClient) {
        compilations.push(
            (async () => {
                const {buildClient} = await import('./client.js');
                return buildClient(config);
            })(),
        );
    }
    if (shouldCompileServer) {
        compilations.push(
            (async () => {
                const {buildServer} = await import('./server.js');
                return buildServer(config);
            })(),
        );
    }
    return Promise.all(compilations);
}
