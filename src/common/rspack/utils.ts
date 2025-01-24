import {prettyTime} from '../logger/pretty-time';

import type {MultiStats} from '@rspack/core';
import type {Logger} from '../logger';

export function rspackCompilerHandlerFactory(logger: Logger, onCompilationEnd?: () => void) {
    return async (err?: Error | null, stats?: MultiStats) => {
        if (err) {
            logger.panic(err.message, err);
        }

        if (stats) {
            logger.message(
                'Stats:\n' +
                    stats.toString({
                        preset: 'errors-warnings',
                        colors: process.stdout.isTTY,
                        assets: logger.isVerbose,
                        modules: logger.isVerbose,
                        entrypoints: logger.isVerbose,
                        timings: logger.isVerbose,
                    }),
            );

            if (stats.hasErrors()) {
                process.exit(1);
            }
        }

        if (onCompilationEnd) {
            await onCompilationEnd();
        }

        const [clientStats] = stats?.stats ?? [];
        if (clientStats) {
            const time = clientStats.endTime || 0 - (clientStats.startTime || 0);
            logger.success(
                `Client was successfully compiled in ${prettyTime(
                    BigInt(time) * BigInt(1_000_000),
                )}`,
            );
        }

        if (!clientStats) {
            logger.success(`Client was successfully compiled`);
        }
    };
}
