import {onExit} from 'signal-exit';

import {ControllableScript} from '../../../common/child-process/controllable-script';
import paths from '../../../common/paths';
import {createRunFolder} from '../../../common/utils';

import type {NormalizedServiceConfig} from '../../../common/models';

function createSWCBuildScript(config: NormalizedServiceConfig) {
    return `
const {Logger} = require(${JSON.stringify(require.resolve('../../../common/logger'))});
const {compile} = require(${JSON.stringify(require.resolve('../../../common/swc/compile'))});

const logger = new Logger('server', ${config.verbose});
compile({
    logger,
    outputPath: ${JSON.stringify(paths.appDist)},
    projectPath: ${JSON.stringify(paths.appServer)},
});`;
}

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
const {Logger} = require(${JSON.stringify(require.resolve('../../../common/logger'))});
const {compile} = require(${JSON.stringify(require.resolve('../../../common/typescript/compile'))});

const logger = new Logger('server', ${config.verbose});
compile(ts, {logger, projectPath: ${JSON.stringify(paths.appServer)}});`;
}

export function buildServer(config: NormalizedServiceConfig): Promise<void> {
    createRunFolder();

    return new Promise((resolve, reject) => {
        const build = new ControllableScript(
            config.server.compiler === 'swc'
                ? createSWCBuildScript(config)
                : createTypescriptBuildScript(config),
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
