import webpack from 'webpack';

import type {NormalizedClientConfig} from '../models';
import {Logger} from '../logger';
import {WebpackMode, webpackConfigFactory} from './config';
import {webpackCompilerHandlerFactory} from './utils';

export async function webpackCompile(config: NormalizedClientConfig): Promise<void> {
    const logger = new Logger('webpack', config.verbose);

    const webpackConfig = await webpackConfigFactory(WebpackMode.Prod, config, {logger});
    logger.verbose('Config created');

    return new Promise((resolve) => {
        const compiler = webpack(
            webpackConfig,
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
