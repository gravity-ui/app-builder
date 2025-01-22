import webpack from 'webpack';

import type {NormalizedClientConfig} from '../models';
import {Logger} from '../logger';
import {WebpackMode, webpackConfigFactory} from './config';
import {webpackCompilerHandlerFactory} from './utils';

export async function rspackCompile(config: NormalizedClientConfig): Promise<void> {
    const logger = new Logger('rspack', config.verbose);

    const webpackConfigs = [await webpackConfigFactory(WebpackMode.Prod, config, {logger})];
    const isSsr = Boolean(config.ssr);
    if (isSsr) {
        const logger = new Logger('rspack(SSR)', config.verbose);
        webpackConfigs.push(await webpackConfigFactory(WebpackMode.Prod, config, {logger, isSsr}));
    }
    logger.verbose('Config created');

    return new Promise((resolve) => {
        const compiler = webpack(
            webpackConfigs,
            webpackCompilerHandlerFactory(logger, async () => {
                resolve();
            }),
        );

        process.on('SIGINT', async () => {
            compiler.close(() => {
                process.exit(1);
            });
        });

        process.on('SIGTERM', async () => {
            compiler.close(() => {
                process.exit(1);
            });
        });
    });
}
