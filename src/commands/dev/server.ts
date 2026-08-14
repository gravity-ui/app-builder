import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {rimraf} from 'rimraf';

import {ControllableScript} from '../../common/child-process/controllable-script.js';
import paths from '../../common/paths.js';

import type {NormalizedServiceConfig} from '../../common/models/index.js';

const require = createRequire(import.meta.url);

function resolveImportUrl(specifier: string) {
    return pathToFileURL(require.resolve(specifier)).href;
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
const [{Logger}, {watch}] = await Promise.all([
    import(${JSON.stringify(resolveImportUrl('../../common/logger/index.js'))}),
    import(${JSON.stringify(resolveImportUrl('../../common/typescript/watch.js'))}),
]);

const logger = new Logger('server', ${config.verbose});
await watch(
    ts,
    ${JSON.stringify(paths.appServer)},
    {
        logger,
        onAfterFilesEmitted: () => {
            process.send({type: 'Emitted'});
        },
        enableSourceMap: true,
        tsBuildInfoFile: ${JSON.stringify(path.join(config.server.outputPath, '.tsbuildinfo'))}
    }
);
})();`;
}

function createSWCBuildScript(config: NormalizedServiceConfig) {
    return `
(async () => {
const [{Logger}, {watch}] = await Promise.all([
    import(${JSON.stringify(resolveImportUrl('../../common/logger/index.js'))}),
    import(${JSON.stringify(resolveImportUrl('../../common/swc/watch.js'))}),
]);

const logger = new Logger('server', ${config.verbose});
await watch(
    ${JSON.stringify(paths.appServer)},
    {
        outputPath: ${JSON.stringify(paths.appDist)},
        logger,
        onAfterFilesEmitted: () => {
            process.send({type: 'Emitted'});
        },
        additionalPaths: ${JSON.stringify(config.server.swcOptions?.additionalPaths)},
        exclude: ${JSON.stringify(config.server.swcOptions?.exclude)},
        publicPath: ${JSON.stringify(config.client.browserPublicPath)},
    }
);
})();`;
}

export async function watchServerCompilation(
    config: NormalizedServiceConfig,
): Promise<ControllableScript> {
    const serverPath = config.server.outputPath;
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
