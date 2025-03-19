"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createS3UploadPlugins = createS3UploadPlugins;
const webpack_plugin_1 = require("./webpack-plugin");
function createS3UploadPlugins(config, logger) {
    const plugins = [];
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
        plugins.push(new webpack_plugin_1.S3UploadPlugin({
            exclude: config.hiddenSourceMap ? /\.map$/ : undefined,
            compress: cdn.compress,
            s3ClientOptions: {
                region: cdn.region,
                endpoint: cdn.endpoint,
                credentials,
            },
            s3UploadOptions: {
                bucket: cdn.bucket,
                targetPath: cdn.prefix,
                cacheControl: cdn.cacheControl,
            },
            additionalPattern: cdn.additionalPattern,
            logger,
        }));
    }
    return plugins;
}
