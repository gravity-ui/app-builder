import {shouldCompileTarget} from '../../../common/utils';

import type {NormalizedServiceConfig} from '../../../common/models';

export default function (config: NormalizedServiceConfig) {
    const shouldCompileClient = shouldCompileTarget(config.target, 'client');
    const shouldCompileServer = shouldCompileTarget(config.target, 'server');

    const compilations: Promise<void>[] = [];
    if (shouldCompileClient) {
        compilations.push(
            (async () => {
                const {buildClient} = await import('./client');
                return buildClient(config);
            })(),
        );
    }
    if (shouldCompileServer) {
        compilations.push(
            (async () => {
                const {buildServer} = await import('./server');
                return buildServer(config);
            })(),
        );
    }
    // createRunFolder();
    return Promise.all(compilations);
}
