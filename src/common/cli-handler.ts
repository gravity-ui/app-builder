import type {Arguments} from 'yargs';

import logger from './logger/index.js';
import {cleanupRspackProfile} from './rspack-profile.js';

export function handlerP(fn: (args: Arguments) => void) {
    return async (args: Arguments): Promise<void> => {
        await Promise.resolve(fn(args)).then(
            async () => {
                await cleanupRspackProfile();
                if (args.keepAlive === true) {
                    // Let active plugin services keep Node alive until the user stops them.
                    // The build succeeded, so stopping it must not look like a failure
                    // (compile.ts installs SIGINT/SIGTERM handlers that exit with 1).
                    process.exitCode = 0;
                    process.once('SIGINT', () => process.exit(0));
                    process.once('SIGTERM', () => process.exit(0));
                } else {
                    process.exit(0);
                }
            },
            async (err) => {
                await cleanupRspackProfile();
                logger.panic(err);
            },
        );
    };
}
