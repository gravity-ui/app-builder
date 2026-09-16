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
                    process.exitCode = 0;
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
