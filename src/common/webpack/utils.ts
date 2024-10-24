import * as path from 'node:path';
import * as fs from 'node:fs';
import {prettyTime} from '../logger/pretty-time';

import type webpack from 'webpack';
import type {Logger} from '../logger';

export function webpackCompilerHandlerFactory(logger: Logger, onCompilationEnd?: () => void) {
    return async (err?: Error | null, stats?: webpack.Stats) => {
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

        if (stats) {
            const time = stats.endTime - stats.startTime;
            logger.success(
                `Client was successfully compiled in ${prettyTime(
                    BigInt(time) * BigInt(1_000_000),
                )}`,
            );
        } else {
            logger.success(`Client was successfully compiled`);
        }
    };
}

const endStarRe = /\/?\*$/;
export function resolveTsconfigPathsToAlias(tsConfigPath: string) {
    if (!fs.existsSync(tsConfigPath) || !fs.statSync(tsConfigPath).isFile) {
        return undefined;
    }

    const {paths = {}, baseUrl} = readJsonConfig(tsConfigPath).compilerOptions || {};

    if (!baseUrl) {
        return undefined;
    }

    const basePath = path.resolve(path.dirname(tsConfigPath), baseUrl);
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

function isCssLoader(
    rule: webpack.RuleSetUseItem,
): rule is Exclude<webpack.RuleSetUseItem, string | Function> {
    return Boolean(
        typeof rule !== 'string' && 'loader' in rule && rule.loader?.includes('/css-loader/'),
    );
}

/**
 * Set correct `importLoaders` value, based on total loaders array
 */
export function setImportLoaders(loaders: webpack.RuleSetUseItem[]) {
    const cssLoaderIndex = loaders.findIndex(isCssLoader);

    if (cssLoaderIndex === -1) {
        return;
    }

    const cssLoader = loaders[cssLoaderIndex];
    const importLoaders = loaders.length - (cssLoaderIndex + 1);

    if (cssLoader && isCssLoader(cssLoader)) {
        if (cssLoader.options && typeof cssLoader.options !== 'string') {
            cssLoader.options.importLoaders = importLoaders;
        }
    }
}
