import * as path from 'node:path';
import {rimraf} from 'rimraf';

import {ControllableScript} from '../../common/child-process/controllable-script';
import {createRunFolder} from '../../common/utils';
import paths from '../../common/paths';

import type {NormalizedServiceConfig} from '../../common/models';

export async function watchServerCompilation(config: NormalizedServiceConfig) {
    const serverPath = path.resolve(paths.appDist, 'server');
    rimraf.sync(serverPath);

    createRunFolder();

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
        const {Logger} = require(${JSON.stringify(require.resolve('../../common/logger'))});
        const {watch} = require(${JSON.stringify(
            require.resolve('../../common/typescript/watch'),
        )});

        const logger = new Logger('server', ${config.verbose});
        watch(
            ts,
            ${JSON.stringify(paths.appServer)},
            {
                logger,
                onAfterFilesEmitted: () => {
                    process.send({type: 'Emitted'});
                },
                enableSourceMap: true
            }
        );
        `,
        null,
    );

    await build.start();

    return build;
}
