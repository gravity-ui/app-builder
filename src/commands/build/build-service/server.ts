import {onExit} from 'signal-exit';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

import {ControllableScript} from '../../../common/child-process/controllable-script.js';
import paths from '../../../common/paths.js';
import {createRunFolder} from '../../../common/utils.js';

import type {NormalizedServiceConfig} from '../../../common/models/index.js';

const require = createRequire(import.meta.url);

function resolveImportUrl(specifier: string) {
    return pathToFileURL(require.resolve(specifier)).href;
}

function createSWCBuildScript(config: NormalizedServiceConfig) {
    return `
(async () => {
const [{Logger}, {compile}] = await Promise.all([
    import(${JSON.stringify(resolveImportUrl('../../../common/logger/index.js'))}),
    import(${JSON.stringify(resolveImportUrl('../../../common/swc/compile.js'))}),
]);

const logger = new Logger('server', ${config.verbose});
await compile({
    logger,
    outputPath: ${JSON.stringify(paths.appDist)},
    projectPath: ${JSON.stringify(paths.appServer)},
    additionalPaths: ${JSON.stringify(config.server.swcOptions?.additionalPaths)},
    exclude: ${JSON.stringify(config.server.swcOptions?.exclude)},
    publicPath: ${JSON.stringify(config.client.browserPublicPath)},
});
})();`;
}

function createTypescriptBuildScript(config: NormalizedServiceConfig) {
    return `
(async () => {
let ts;
try {
    ts = require('typescript');
} catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }
    ts = require(${JSON.stringify(require.resolve('typescript'))});
}
const [{Logger}, {compile}] = await Promise.all([
    import(${JSON.stringify(resolveImportUrl('../../../common/logger/index.js'))}),
    import(${JSON.stringify(resolveImportUrl('../../../common/typescript/compile.js'))}),
]);

const logger = new Logger('server', ${config.verbose});
await compile(ts, {logger, projectPath: ${JSON.stringify(paths.appServer)}});
})();`;
}

export function buildServer(config: NormalizedServiceConfig): Promise<void> {
    createRunFolder(config);

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
