import * as path from 'node:path';
import {rimraf} from 'rimraf';

import {ControllableScript} from '../../common/child-process/controllable-script';
import paths from '../../common/paths';

import type {NormalizedServiceConfig} from '../../common/models';

function createTypescriptBuildScript(config: NormalizedServiceConfig) {
    return `
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
const {watch} = require(${JSON.stringify(require.resolve('../../common/typescript/watch'))});

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
);`;
}

function createSWCBuildScript(config: NormalizedServiceConfig) {
    return `
const {Logger} = require(${JSON.stringify(require.resolve('../../common/logger'))});
const {watch} = require(${JSON.stringify(require.resolve('../../common/swc/watch'))});

const logger = new Logger('server', ${config.verbose});
watch(
    ${JSON.stringify(paths.appServer)},
    {
        outputPath: ${JSON.stringify(paths.appDist)},
        logger,
        onAfterFilesEmitted: () => {
            process.send({type: 'Emitted'});
        },
    }
);`;
}

export async function watchServerCompilation(
    config: NormalizedServiceConfig,
): Promise<ControllableScript> {
    const serverPath = path.resolve(paths.appDist, 'server');
    rimraf.sync(serverPath);

    const build = new ControllableScript(
        config.server.compiler === 'swc'
            ? createSWCBuildScript(config)
            : createTypescriptBuildScript(config),
        null,
    );

    await build.start();

    return build;
}
