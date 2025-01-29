import * as path from 'node:path';
import * as ts from 'typescript';
import {prettyTime} from '../logger/pretty-time';
import {getTsProjectConfig} from '../typescript/utils';

import type * as Webpack from 'webpack';
import type {Logger} from '../logger';

export function webpackCompilerHandlerFactory(logger: Logger, onCompilationEnd?: () => void) {
    return async (err?: Error | null, stats?: Webpack.MultiStats) => {
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

        const [clientStats, ssrStats] = stats?.stats ?? [];
        if (clientStats) {
            const {startTime = 0, endTime = 0} = clientStats;
            const time = endTime - startTime;
            logger.success(
                `Client was successfully compiled in ${prettyTime(
                    BigInt(time) * BigInt(1_000_000),
                )}`,
            );
        }

        if (ssrStats) {
            const {startTime = 0, endTime = 0} = ssrStats;
            const time = endTime - startTime;
            logger.success(
                `SSR: Client was successfully compiled in ${prettyTime(
                    BigInt(time) * BigInt(1_000_000),
                )}`,
            );
        }

        if (!clientStats && !ssrStats) {
            logger.success(`Client was successfully compiled`);
        }
    };
}

const endStarRe = /\/?\*$/;
export function resolveTsConfigPathsToAlias(projectPath: string, filename = 'tsconfig.json') {
    let parsed;
    try {
        parsed = getTsProjectConfig(ts, projectPath, filename);
    } catch {
        return {};
    }

    if (parsed.errors.length > 0) {
        return {};
    }

    const {paths = {}, baseUrl} = parsed.options;

    if (!baseUrl) {
        return {};
    }

    const basePath = path.resolve(path.dirname(projectPath), baseUrl);
    const aliases: Record<string, string[]> = {};
    const modules: string[] = [basePath];
    for (const [key, value] of Object.entries(paths)) {
        if (!Array.isArray(value) || value.length === 0) {
            continue;
        }
        const name = key.replace(endStarRe, '');
        if (name === '' || name === '.') {
            modules.push(
                ...value.map((v) => path.resolve(basePath, `${v}`.replace(endStarRe, ''))),
            );
            continue;
        }

        aliases[name] = value.map((v) => path.resolve(basePath, `${v}`.replace(endStarRe, '')));
    }

    return {aliases, modules};
}
