import {onExit} from 'signal-exit';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {ControllableScript} from '../../common/child-process/controllable-script.js';

import type {LibraryConfig} from '../../common/models/index.js';

const require = createRequire(import.meta.url);

export default function (config: LibraryConfig) {
    return new Promise((resolve, reject) => {
        const build = new ControllableScript(
            `
(async () => {
    const {buildLibrary} = await import(${JSON.stringify(
        pathToFileURL(require.resolve('../../common/library/index.js')).href,
    )});
    buildLibrary({lib: ${JSON.stringify(config.lib)}});
})();
            `,
            null,
        );

        build.start().then(
            () => {
                build.onExit((code) => {
                    if (code) {
                        reject(new Error('Error build library'));
                    } else {
                        resolve(true);
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
