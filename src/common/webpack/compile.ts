import webpack from 'webpack';

import type {NormalizedServiceConfig} from '../models';
import {Logger} from '../logger';
import {WebpackMode, webpackConfigFactory} from './config';
import {webpackCompilerHandlerFactory} from './utils';

export function webpackCompile(config: NormalizedServiceConfig): Promise<void> {
    const logger = new Logger('webpack', config.verbose);
    return new Promise((resolve) => {
        const webpackConfig = webpackConfigFactory(WebpackMode.Prod, config, {logger});
        logger.verbose('Config created');
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
