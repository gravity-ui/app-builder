import {onExit} from 'signal-exit';

import {ControllableScript} from '../../../common/child-process/controllable-script';
import paths from '../../../common/paths';
import {createRunFolder} from '../../../common/utils';

import type {NormalizedServiceConfig} from '../../../common/models';

export function buildServer(config: NormalizedServiceConfig): Promise<void> {
    createRunFolder();

    return new Promise((resolve, reject) => {
        const tsconfigFileName = config.server.tsconfigFileName || 'tsconfig.json';

        const build = new ControllableScript(
            `
        let ts;
        try {
            ts = require('typescript');
        } catch (e) {
            if (e.code !== 'MODULE_NOT_FOUND') {
                throw e;
            }
            ts = require(${JSON.stringify(require.resolve('typescript'))});
        }
        const {Logger} = require(${JSON.stringify(require.resolve('../../../common/logger'))});
        const {compile} = require(${JSON.stringify(
            require.resolve('../../../common/typescript/compile'),
        )});

        const logger = new Logger('server', ${config.verbose});
        compile(ts, {
            logger,
            projectPath: ${JSON.stringify(paths.appServer)},
            configFileName: ${JSON.stringify(tsconfigFileName)}
        });
    `,
            null,
        );

        build.start().then(
            () => {
                build.onExit((code) => {
                    if (code) {
                        reject(new Error('Error compile server'));
                    } else {
                        resolve();
                    }
                });

                process.on('SIGINT', async () => {
                    await build.stop('SIGINT');
                    process.exit(1);
                });

                process.on('SIGTERM', async () => {
                    await build.stop('SIGTERM');
                    process.exit(1);
                });

                onExit((_code, signal) => {
                    build.stop(signal);
                });
            },
            (error) => {
                reject(error);
            },
        );
    });
}
