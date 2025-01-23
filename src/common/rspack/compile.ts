import {rspack} from '@rspack/core';

import type {NormalizedClientConfig} from '../models';
import {Logger} from '../logger';
import {RspackMode, rspackConfigFactory} from './config';
import {webpackCompilerHandlerFactory} from './utils';

export async function rspackCompile(config: NormalizedClientConfig): Promise<void> {
    const logger = new Logger('rspack', config.verbose);

    const rspackConfigs = [await rspackConfigFactory(RspackMode.Prod, config, {logger})] as const;
    logger.verbose('Config created');

    return new Promise((resolve) => {
        const compiler = rspack(
            rspackConfigs,
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
