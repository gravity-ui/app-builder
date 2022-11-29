import * as path from 'path';

import PQueue from 'p-queue';

import {getS3Client, S3ClientOptions, S3UploadFileOptions} from './s3-client.js';
import {brotli, gzip} from './compress.js';

export interface UploadOptions {
    bucket: string;
    sourcePath: string;
    targetPath?: string;
    existsBehavior?: 'overwrite' | 'throw' | 'ignore';
}

export interface UploadFilesOptions {
    s3: S3ClientOptions;
    concurrency?: number;
    compress?: boolean;
    options: UploadOptions;
}

export function uploadFiles(files: string[], config: UploadFilesOptions) {
    const s3Client = getS3Client(config.s3);

    const queue = new PQueue({
        concurrency: config.concurrency ?? 512,
    });

    const processFile = fileProcessor(config.options);

    return Promise.all(
        files.flatMap((filePath) => {
            const relativeFilePath = path.isAbsolute(filePath)
                ? path.relative(config.options.sourcePath, filePath)
                : filePath;
            return processFile(relativeFilePath);
        }),
    );

    function doesExist(bucket: string, key: string): Promise<boolean> {
        return queue
            .add(() => s3Client.headObject(bucket, key))
            .then(() => true)
            .catch(() => false);
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
            const sourceFilePath = path.join(options.sourcePath, relativeFilePath);
            const targetFilePath = path.join(options.targetPath || '', relativeFilePath);

            console.info(`Uploading file ${relativeFilePath} ...`);
            const exists = await doesExist(options.bucket, targetFilePath);

            if (exists) {
                switch (options.existsBehavior) {
                    case 'overwrite': {
                        console.info(`File ${targetFilePath} will be overwritten.`);
                        break;
                    }
                    case 'throw': {
                        throw new Error(
                            `File ${targetFilePath} already exists in ${options.bucket}`,
                        );
                    }
                    default: {
                        console.info(`Nothing todo with '${relativeFilePath}'`);
                        return Promise.resolve(relativeFilePath);
                    }
                }
            }

            return uploadFile(options.bucket, sourceFilePath, targetFilePath)
                .then(() => {
                    console.info(`  ${relativeFilePath} => ${targetFilePath}`);

                    return relativeFilePath;
                })
                .catch((error) => {
                    console.error(`Failed to upload file ${relativeFilePath}`);
                    if (error instanceof Error) {
                        console.error(`msg: ${error.message}`);
                    }

                    throw error;
                });
        };
    }

    function compress(sourcePath: string) {
        return [queue.add(() => gzip(sourcePath)), queue.add(() => brotli(sourcePath))];
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

function shouldCompress(filePath: string) {
    const fileName = path.basename(filePath);
    const extension = fileName.split('.').pop() as string;

    return !NOT_COMPRESS.includes(extension);
}
