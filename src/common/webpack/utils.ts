import path from 'path';
import fs from 'fs';
import {prettyTime} from '../logger/pretty-time';

import type webpack from 'webpack';
import type {Logger} from '../logger';

export function webpackCompilerHandlerFactory(logger: Logger, onCompilationEnd?: () => void) {
    return async (err?: Error, stats?: webpack.Stats) => {
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

        const time = stats?.endTime - stats?.startTime;
        logger.success(
            `Client was successfully compiled in ${prettyTime(BigInt(time) * BigInt(1_000_000))}`,
        );
    };
}

const endStarRe = /\/?\*$/;
export function resolveTsconfigPathsToAlias(tsConfigPath: string) {
    if (!fs.existsSync(tsConfigPath) || !fs.statSync(tsConfigPath).isFile) {
        return undefined;
    }

    const {paths = {}, baseUrl = '.'} = readJsonConfig(tsConfigPath).compilerOptions || {};

    const basePath = path.resolve(path.dirname(tsConfigPath), baseUrl);
    const aliases: Record<string, string> = {};
    const modules: string[] = [];
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

        aliases[name] = path.resolve(basePath, `${value[0]}`.replace(endStarRe, ''));
    }

    return {aliases, modules};
}

function readJsonConfig(pathname: string) {
    try {
        const json = fs.readFileSync(pathname, 'utf-8');
        return {
            ...JSON.parse(json),
        };
    } catch {
        throw new Error(`Couldn't read config ${pathname}`);
    }
}
