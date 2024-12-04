import webpack from 'webpack';

import type {NormalizedClientConfig} from '../models';
import {Logger} from '../logger';
import {BundleType, WebpackMode, webpackConfigFactory} from './config';
import {webpackCompilerHandlerFactory} from './utils';

async function webpackCompileWithConfig(config: NormalizedClientConfig, bundleType: BundleType) {
    const logger = new Logger('webpack', config.verbose);

    const webpackConfig = await webpackConfigFactory(
        WebpackMode.Prod,
        config,
        {logger},
        bundleType,
    );

    logger.verbose(`Config for ${bundleType} created`);

    return new Promise<void>((resolve) => {
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

export async function webpackCompile(config: NormalizedClientConfig): Promise<void[]> {
    return Promise.all(
        [
            webpackCompileWithConfig(config, BundleType.Browser),
            Boolean(config.ssr) && webpackCompileWithConfig(config, BundleType.Ssr),
        ].filter(Boolean) as Promise<void>[],
    );
}
