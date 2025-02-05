import {ManifestPluginOptions} from 'rspack-manifest-plugin';
import type {RuleSetRule as WebpackRuleSetRule} from 'webpack';

import {Compiler, MultiStats, rspack} from '@rspack/core';
import type {Configuration, RuleSetRule as RspackRuleSetRule} from '@rspack/core';

import * as fs from 'node:fs';
import * as path from 'node:path';
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

type Entrypoints = Record<
    string,
    {
        assets: {
            js: string[];
            css: string[];
        };
    }
>;

export const generateAssetsManifest: ManifestPluginOptions['generate'] = (seed, files, entries) => {
    const manifestFiles = files.reduce((manifest, file) => {
        manifest[file.name] = file.path;
        return manifest;
    }, seed);

    const entrypoints = Object.keys(entries).reduce<Entrypoints>((previous, name) => {
        return {
            ...previous,
            [name]: {
                assets: {
                    js: entries[name]!.filter((file) => file.endsWith('.js')),
                    css: entries[name]!.filter((file) => file.endsWith('.css')),
                },
            },
        };
    }, {});

    return {
        files: manifestFiles,
        entrypoints,
    };
};

function prepareRspackUse(webpackUse: WebpackRuleSetRule['use']): RspackRuleSetRule['use'] {
    if (typeof webpackUse === 'string') {
        if (webpackUse === 'swc-loader') {
            return 'builtin:swc-loader';
        }
        return webpackUse;
    }
    if (Array.isArray(webpackUse)) {
        for (const item of webpackUse) {
            if (item) {
                prepareRspackUse(item);
            }
        }
    }
    return webpackUse as RspackRuleSetRule['use'];
}

export function prepareRspackRules(
    webpackRules: (undefined | null | false | '' | 0 | WebpackRuleSetRule | '...')[],
): (RspackRuleSetRule | '...')[] {
    const rspackRules: (RspackRuleSetRule | '...')[] = [];
    for (const webpackRule of webpackRules) {
        if (!webpackRule) {
            continue;
        }
        if (typeof webpackRule === 'string') {
            rspackRules.push(webpackRule);
            continue;
        }

        const rspackRule = webpackRule as RspackRuleSetRule;
        if (webpackRule.oneOf) {
            rspackRule.oneOf = prepareRspackRules(webpackRule.oneOf) as RspackRuleSetRule[];
        }
        if (webpackRule.rules) {
            rspackRule.rules = prepareRspackRules(webpackRule.rules) as RspackRuleSetRule[];
        }
        if (webpackRule.use) {
            rspackRule.use = prepareRspackUse(webpackRule.use);
        }
        rspackRules.push(rspackRule);
    }
    return rspackRules;
}

import {elapsedTime, prettyTime} from '../logger/pretty-time';

interface State {
    done?: boolean;
    start?: bigint;
}

export class RspackProgressPlugin extends rspack.ProgressPlugin {
    private _logger: Logger;
    private _state: State = {};

    constructor({logger}: {logger: Logger}) {
        super();
        this._logger = logger;
    }

    handler = (percent: number, message: string, ...details: string[]) => {
        const progress = Math.floor(percent * 100);
        this._logger.status(
            `${this._logger.colors.green(`${progress}%`)} - ${this._logger.colors.yellow(message)}${
                details.length > 0 ? `: ${this._logger.colors.dim(...details)}` : ''
            }`,
        );
    };

    apply(compiler: Compiler) {
        super.apply(compiler);

        hook(compiler, 'compile', () => {
            this._logger.message('Start compilation');
            this._logger.message(`rspack v${compiler.rspack.rspackVersion}`);
            this._state.start = process.hrtime.bigint();
        });

        hook(compiler, 'invalid', (fileName, changeTime) => {
            this._logger.verbose(`Invalidate file: ${fileName} at ${changeTime}`);
        });

        hook(compiler, 'done', (stats) => {
            const time = this._state.start ? ' in ' + elapsedTime(this._state.start) : '';

            const hasErrors = stats.hasErrors();
            if (hasErrors) {
                this._logger.error('Compiled with some errors' + time);
            } else {
                this._logger.success('Compiled successfully' + time);
            }
        });
    }
}

function hook<HookName extends keyof Compiler['hooks']>(
    compiler: Compiler,
    hookName: HookName,
    callback: Parameters<Compiler['hooks'][HookName]['tap']>[1],
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    compiler.hooks[hookName].tap(`app-builder: ${hookName}`, callback as any);
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
