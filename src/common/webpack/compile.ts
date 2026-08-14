import webpack from 'webpack';
// TypeScript 5.6 does not know that modern Node.js can require synchronous ESM.
// @ts-ignore -- ts-jest uses CommonJS resolution while @rspack/core 2 is ESM.
import {Configuration as RspackConfiguration, rspack} from '@rspack/core';

import type {NormalizedClientConfig} from '../models/index.js';
import {Logger} from '../logger/index.js';
import {WebpackMode, rspackConfigFactory, webpackConfigFactory} from './config.js';
import {compilerHandlerFactory} from './utils.js';

export async function clientCompile(
    config: NormalizedClientConfig,
    configPath?: string,
): Promise<void> {
    const logger = new Logger('client', config.verbose);

    const webpackConfigs: webpack.Configuration[] = [];
    const rspackConfigs: RspackConfiguration[] = [];

    const isSsr = Boolean(config.ssr);

    if (config.bundler === 'rspack') {
        rspackConfigs.push(
            await rspackConfigFactory({
                webpackMode: WebpackMode.Prod,
                config,
                configPath,
                logger,
            }),
        );

        if (isSsr) {
            const ssrLogger = new Logger('client(SSR)', config.verbose);
            rspackConfigs.push(
                await rspackConfigFactory({
                    webpackMode: WebpackMode.Prod,
                    config,
                    configPath,
                    logger: ssrLogger,
                    isSsr,
                }),
            );
        }
    } else {
        webpackConfigs.push(
            await webpackConfigFactory({
                webpackMode: WebpackMode.Prod,
                config,
                configPath,
                logger,
            }),
        );

        if (isSsr) {
            const ssrLogger = new Logger('client(SSR)', config.verbose);
            webpackConfigs.push(
                await webpackConfigFactory({
                    webpackMode: WebpackMode.Prod,
                    config,
                    configPath,
                    logger: ssrLogger,
                    isSsr,
                }),
            );
        }
    }

    logger.verbose('Config created');

    return new Promise((resolve) => {
        const compilerHandler = compilerHandlerFactory(logger, async () => {
            resolve();
        });

        const compiler =
            config.bundler === 'rspack'
                ? rspack(rspackConfigs, compilerHandler)
                : webpack(webpackConfigs, compilerHandler);

        process.on('SIGINT', async () => {
            compiler?.close(() => {
                process.exit(1);
            });
        });

        process.on('SIGTERM', async () => {
            compiler?.close(() => {
                process.exit(1);
            });
        });
    });
}
