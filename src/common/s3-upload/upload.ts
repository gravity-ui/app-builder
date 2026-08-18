import * as path from 'node:path';

import logger from '../logger/index.js';
import {getS3Client} from './s3-client.js';
import {brotli, gzip} from './compress.js';

import type {Logger} from '../logger/index.js';
import type {S3ClientOptions, S3UploadFileOptions} from './s3-client.js';

export interface UploadOptions {
    bucket: string;
    sourcePath: string;
    targetPath?: string;
    /** @default 'ignore' */
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

export async function uploadFiles(files: string[], config: UploadFilesOptions) {
    const s3Client = getS3Client(config.s3);
    const log = config.logger ?? logger;

    const {default: PQueue} = await import('p-queue');

    const queue = new PQueue({
        concurrency: config.concurrency ?? 512,
    });

    const processFile = fileProcessor(config.options);

    return Promise.all(
        files.flatMap((filePath) => {
            const relativeFilePath = getRelativeFilePath(config.options.sourcePath, filePath);
            return processFile(relativeFilePath);
        }),
    );

    async function doesExist(bucket: string, key: string): Promise<boolean> {
        try {
            await queue.add(() => s3Client.headObject(bucket, key));
            return true;
        } catch (error) {
            if (isNotFoundError(error)) {
                return false;
            }

            throw error;
        }
    }

    function uploadFile(
        bucket: string,
        sourceFilePath: string,
        targetFilePath: string,
        options?: S3UploadFileOptions,
    ) {
        return queue.add(() =>
            s3Client.uploadFile(bucket, sourceFilePath, targetFilePath, options),
        );
    }

    function fileUploader(options: UploadOptions) {
        return async (relativeFilePath: string) => {
            const sourceFilePath = path.resolve(options.sourcePath, relativeFilePath);
            const targetFilePath = path.posix.join(
                toPosixPath(options.targetPath ?? ''),
                toPosixPath(relativeFilePath),
            );

            log.verbose(`Uploading file ${relativeFilePath} ...`);
            const existsBehavior = options.existsBehavior ?? 'ignore';

            if (existsBehavior !== 'overwrite') {
                const exists = await doesExist(options.bucket, targetFilePath);

                if (exists) {
                    if (existsBehavior === 'throw') {
                        throw new Error(
                            `File ${targetFilePath} already exists in ${options.bucket}`,
                        );
                    }

                    log.message(
                        `Nothing to do with '${relativeFilePath}' because '${targetFilePath}' already exists in '${options.bucket}'`,
                    );
                    return relativeFilePath;
                }
            }

            const cacheControl =
                typeof options.cacheControl === 'function'
                    ? options.cacheControl(targetFilePath)
                    : options.cacheControl;
            const contentEncoding = getContentEncoding(relativeFilePath);

            return uploadFile(options.bucket, sourceFilePath, targetFilePath, {
                cacheControl,
                ...(contentEncoding && {contentEncoding}),
            })
                .then(() => {
                    log.message(`Uploaded ${relativeFilePath} => ${targetFilePath}`);

                    return relativeFilePath;
                })
                .catch((error) => {
                    log.error(`Failed to upload file ${relativeFilePath}`);
                    if (error instanceof Error) {
                        log.error(`msg: ${error.message}`);
                    }

                    throw error;
                });
        };
    }

    function compress(sourcePath: string) {
        // throwOnTimeout is only used to get the correct type and does not change behavior since we are not setting a timeout.
        return [
            queue.add(() => gzip(sourcePath), {throwOnTimeout: true}),
            queue.add(() => brotli(sourcePath), {throwOnTimeout: true}),
        ];
    }

    function fileProcessor(options: UploadOptions) {
        return (relativeFilePath: string) => {
            const upload = fileUploader(options);
            const filesPromises = [upload(relativeFilePath)];

            if (config.compress && shouldCompress(relativeFilePath)) {
                const sourcePath = path.join(options.sourcePath, relativeFilePath);
                filesPromises.push(
                    ...compress(sourcePath).map((promise) => {
                        return promise.then((compressedFile) => {
                            const relativeCompressedFilePath = path.relative(
                                options.sourcePath,
                                compressedFile,
                            );
                            return upload(relativeCompressedFilePath);
                        });
                    }),
                );
            }

            return filesPromises;
        };
    }
}

const NOT_COMPRESS = ['png', 'zip', 'gz', 'br'];

function getRelativeFilePath(sourcePath: string, filePath: string) {
    const absoluteSourcePath = path.resolve(sourcePath);
    const absoluteFilePath = path.resolve(absoluteSourcePath, filePath);
    const relativeFilePath = path.relative(absoluteSourcePath, absoluteFilePath);

    if (
        relativeFilePath === '..' ||
        relativeFilePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeFilePath)
    ) {
        throw new Error(`File ${filePath} is outside of source path ${sourcePath}`);
    }

    return relativeFilePath;
}

function toPosixPath(filePath: string) {
    return filePath.split(path.sep).join(path.posix.sep);
}

function getContentEncoding(filePath: string) {
    switch (path.extname(filePath).toLowerCase()) {
        case '.gz':
            return 'gzip';
        case '.br':
            return 'br';
        default:
            return undefined;
    }
}

function isNotFoundError(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const s3Error = error as {
        name?: string;
        $metadata?: {httpStatusCode?: number};
    };

    return (
        s3Error.$metadata?.httpStatusCode === 404 ||
        s3Error.name === 'NotFound' ||
        s3Error.name === 'NoSuchKey'
    );
}

function shouldCompress(filePath: string) {
    const fileName = path.basename(filePath);
    const extension = fileName.split('.').pop() as string;

    return !NOT_COMPRESS.includes(extension);
}
