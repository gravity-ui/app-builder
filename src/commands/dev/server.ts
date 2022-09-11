import path from 'path';
import rimraf from 'rimraf';

import {ControllableScript} from '../../common/child-process/controllable-script';
import {createRunFolder} from '../../common/utils';
import paths from '../../common/paths';

import type {NormalizedServiceConfig} from '../../common/models';

export function watchServerCompilation(config: NormalizedServiceConfig) {
    const serverPath = path.resolve(paths.appDist, 'server');
    rimraf.sync(serverPath);

    rimraf.sync(paths.appRun);
    createRunFolder();

    const build = new ControllableScript(
        `
        const ts = require('typescript');
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
                enableSourceMap: ${config.inspect || config.inspectBrk ? 'true' : 'false'}
            }
        );
        `,
        null,
    );

    build.start();

    return build;
}
