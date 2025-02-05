import webpack from 'webpack';
import {Configuration as RspackConfiguration, rspack} from '@rspack/core';

import type {NormalizedClientConfig} from '../models';
import {Logger} from '../logger';
import {WebpackMode, rspackConfigFactory, webpackConfigFactory} from './config';
import {webpackCompilerHandlerFactory} from './utils';
import {rspackCompilerHandlerFactory} from './rspack';

export async function clientCompile(config: NormalizedClientConfig): Promise<void> {
    const logger = new Logger('client', config.verbose);

    const webpackConfigs: webpack.Configuration[] = [];
    const rspackConfigs: RspackConfiguration[] = [];

    const isSsr = Boolean(config.ssr);

    if (config.bundler === 'rspack') {
        rspackConfigs.push(
            await rspackConfigFactory({webpackMode: WebpackMode.Prod, config, logger}),
        );

        if (isSsr) {
            const ssrLogger = new Logger('client(SSR)', config.verbose);
            rspackConfigs.push(
                await rspackConfigFactory({
                    webpackMode: WebpackMode.Prod,
                    config,
                    logger: ssrLogger,
                    isSsr,
                }),
            );
        }
    } else {
        webpackConfigs.push(
            await webpackConfigFactory({webpackMode: WebpackMode.Prod, config, logger}),
        );

        if (isSsr) {
            const ssrLogger = new Logger('client(SSR)', config.verbose);
            webpackConfigs.push(
                await webpackConfigFactory({
                    webpackMode: WebpackMode.Prod,
                    config,
                    logger: ssrLogger,
                    isSsr,
                }),
            );
        }
    }

    logger.verbose('Config created');

    return new Promise((resolve) => {
        const compiler =
            config.bundler === 'rspack'
                ? rspack(
                      rspackConfigs,
                      rspackCompilerHandlerFactory(logger, async () => {
                          resolve();
                      }),
                  )
                : webpack(
                      webpackConfigs,
                      webpackCompilerHandlerFactory(logger, async () => {
                          resolve();
                      }),
                  );

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
