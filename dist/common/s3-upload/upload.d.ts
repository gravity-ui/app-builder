import type { Logger } from '../logger/index.js';
import type { S3ClientOptions } from './s3-client.js';
export interface UploadOptions {
    bucket: string;
    sourcePath: string;
    targetPath?: string;
    existsBehavior?: 'overwrite' | 'throw' | 'ignore';
    cacheControl?: string | ((filename: string) => string);
}
export interface UploadFilesOptions {
    s3: S3ClientOptions;
    concurrency?: number;
    compress?: boolean;
    options: UploadOptions;
    logger?: Logger;
}
export declare function uploadFiles(files: string[], config: UploadFilesOptions): Promise<string[]>;
