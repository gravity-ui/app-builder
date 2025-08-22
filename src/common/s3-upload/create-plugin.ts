import * as path from 'node:path';
import {NormalizedClientConfig} from '../models';
import {S3UploadPlugin} from './webpack-plugin';
import type {Configuration} from 'webpack';
import type {Logger} from '../logger';

export function createS3UploadPlugins(config: NormalizedClientConfig, logger?: Logger) {
    const plugins: Required<Configuration['plugins']> = [];

    let credentialsGlobal;
    if (process.env.FRONTEND_S3_ACCESS_KEY_ID && process.env.FRONTEND_S3_SECRET_ACCESS_KEY) {
        credentialsGlobal = {
            accessKeyId: process.env.FRONTEND_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.FRONTEND_S3_SECRET_ACCESS_KEY,
        };
    }
    const cdns = Array.isArray(config.cdn) ? config.cdn : [config.cdn];
    for (let index = 0; index < cdns.length; index++) {
        const cdn = cdns[index];
        if (!cdn) {
            continue;
        }
        let credentials = credentialsGlobal;
        const accessKeyId = process.env[`FRONTEND_S3_ACCESS_KEY_ID_${index}`];
        const secretAccessKey = process.env[`FRONTEND_S3_SECRET_ACCESS_KEY_${index}`];
        if (accessKeyId && secretAccessKey) {
            credentials = {
                accessKeyId,
                secretAccessKey,
            };
        }

        let targetPath = cdn.prefix;

        if (config.moduleFederation && targetPath !== undefined) {
            targetPath = path.join(targetPath, config.moduleFederation.name);
        }

        plugins.push(
            new S3UploadPlugin({
                exclude: config.hiddenSourceMap ? /\.map$/ : undefined,
                compress: cdn.compress,
                s3ClientOptions: {
                    region: cdn.region,
                    endpoint: cdn.endpoint,
                    credentials,
                },
                s3UploadOptions: {
                    bucket: cdn.bucket,
                    targetPath,
                    cacheControl: cdn.cacheControl,
                },
                additionalPattern: cdn.additionalPattern,
                logger,
            }),
        );
    }

    return plugins;
}
