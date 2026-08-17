import * as path from 'node:path';
import * as ts from 'typescript';
import {prettyTime} from '../logger/pretty-time.js';
import {getTsProjectConfig} from '../typescript/utils.js';

import type * as Webpack from 'webpack';
import type {Logger} from '../logger/index.js';
// TypeScript 5.6 does not know that modern Node.js can require synchronous ESM.
// @ts-ignore -- ts-jest uses CommonJS resolution while @rspack/core 2 is ESM.
import {MultiStats} from '@rspack/core';
import {
    NormalizedClientBaseConfig,
    NormalizedClientConfig,
    WebWorkerHandle,
} from '../models/index.js';

export function compilerHandlerFactory(logger: Logger, onCompilationEnd?: () => void) {
    return async (err?: Error | null, stats?: Webpack.MultiStats | MultiStats) => {
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

    const {paths = {}, baseUrl, configFilePath} = parsed.options;

    // `baseUrl` is deprecated since TypeScript 5.x in favor of resolving `paths`
    // relative to the directory containing the tsconfig.json file.
    // See: https://www.typescriptlang.org/tsconfig/#baseUrl
    const configDir = configFilePath
        ? path.dirname(String(configFilePath))
        : path.dirname(projectPath);

    const basePath = baseUrl ? path.resolve(configDir, baseUrl) : configDir;
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

export function isRsdoctorOnlyJson(
    env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
    const value = env.RSDOCTOR_ONLY_JSON;
    return (
        typeof value === 'string' &&
        new Set(['1', 'true', 'yes', 'on']).has(value.trim().toLowerCase())
    );
}

export function shouldUseRsdoctor(
    config: Pick<NormalizedClientBaseConfig, 'analyzeBundle'>,
    env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
    return config.analyzeBundle === 'rsdoctor' || isRsdoctorOnlyJson(env);
}

export function getNormalizedWorkerOption(config: NormalizedClientConfig) {
    let webWorkerHandle: WebWorkerHandle = 'loader';

    if (config.newWebWorkerSyntax) {
        webWorkerHandle = 'cdn-compat';
    }

    if (config.webWorkerHandle) {
        webWorkerHandle = config.webWorkerHandle;
    }

    return webWorkerHandle;
}
