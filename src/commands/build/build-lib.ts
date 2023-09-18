import {onExit} from 'signal-exit';
import {ControllableScript} from '../../common/child-process/controllable-script';

import type {LibraryConfig} from '../../common/models';

export default function (config: LibraryConfig) {
    return new Promise((resolve, reject) => {
        const build = new ControllableScript(
            `
        const {buildLibrary} = require(${JSON.stringify(require.resolve('../../common/library'))});
        buildLibrary({lib: ${JSON.stringify(config.lib)}});
            `,
            null,
        );

        build.start();
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
            build.stop(signal as any);
        });
    });
}
