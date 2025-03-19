import type * as Webpack from 'webpack';
import type { Logger } from '../logger/index.js';
import type { UploadOptions } from './upload.js';
import type { S3ClientOptions } from './s3-client.js';
interface S3UploadPluginOptions {
    include?: Rule | Rule[];
    exclude?: Rule | Rule[];
    compress?: boolean;
    s3ClientOptions: S3ClientOptions;
    s3UploadOptions: Pick<UploadOptions, 'bucket' | 'targetPath' | 'existsBehavior' | 'cacheControl'>;
    additionalPattern?: string | string[];
    logger?: Logger;
}
export declare class S3UploadPlugin {
    private options;
    constructor(options: S3UploadPluginOptions);
    apply(compiler: Webpack.Compiler): void;
    private isIncludeAndNotExclude;
}
type Rule = RegExp | string | ((s: string) => boolean);
export {};
