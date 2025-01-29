import {prettyTime} from '../logger/pretty-time';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {Configuration, MultiStats} from '@rspack/core';
import type {Logger} from '../logger';
import paths from '../../common/paths';

export function clearCacheDirectory(config: Configuration, logger: Logger) {
    if (!config.cache) {
        return;
    }

    let cacheDirectory = path.join(paths.appNodeModules, '.cache/rspack');

    if (
        typeof config.experiments?.cache === 'object' &&
        config.experiments.cache.type === 'persistent' &&
        config.experiments.cache.storage?.directory
    ) {
        cacheDirectory = config.experiments.cache.storage?.directory;
    }

    if (fs.existsSync(cacheDirectory)) {
        fs.rmdirSync(cacheDirectory, {recursive: true});
        logger.message(`Rspack cache ${cacheDirectory} successfully cleared`);
    }
}

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
            const time = (clientStats.endTime || 0) - (clientStats.startTime || 0);
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
