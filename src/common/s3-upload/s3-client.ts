import * as fs from 'fs/promises';
import * as path from 'node:path';

import {
    DeleteObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import * as mime from 'mime-types';
import {globSync} from 'fast-glob';

import type {PutObjectCommandInput, S3ClientConfig} from '@aws-sdk/client-s3';

export type S3ClientOptions = S3ClientConfig;
export function getS3Client(options: S3ClientOptions) {
    const s3Client = new S3Client(options);

    return {
        headObject(bucket: string, key: string) {
            return s3Client.send(new HeadObjectCommand({Bucket: bucket, Key: key}));
        },

        async uploadFile(
            bucket: string,
            localFileOrPath: string | Buffer,
            key: string,
            opts: S3UploadFileOptions = {},
        ) {
            const isBuffer = Buffer.isBuffer(localFileOrPath);
            const bodyBuffer = isBuffer ? localFileOrPath : await fs.readFile(localFileOrPath);

            let contentType = opts.contentType;
            if (!contentType) {
                contentType = isBuffer
                    ? await detectContentTypeFromBuffer(localFileOrPath)
                    : detectContentTypeFromExt(localFileOrPath);
            }

            const meta = opts.meta;
            const expires = opts.expires;
            const contentEncoding = opts.contentEncoding;

            const params: PutObjectCommandInput = {
                Bucket: bucket,
                Key: key,
                Body: bodyBuffer,
                Metadata: meta,
                Expires: expires,
                ContentEncoding: contentEncoding,
                ContentType: contentType,
            };

            if (expires) {
                params.Metadata = {...params.Metadata, Expires: expires.toString()};
            }

            if (opts.cacheControl) {
                params.CacheControl = opts.cacheControl;
            }

            return s3Client.send(new PutObjectCommand(params));
        },

        async uploadDir(
            bucket: string,
            dirPath: string,
            keyPrefix = '',
            {concurrency = 512, ...opts}: S3UploadDirOptions = {},
        ) {
            const files = globSync('**', {cwd: dirPath});

            const {default: pMap} = await import('p-map');
            return pMap(
                files,
                (filePath) => {
                    const sourcePath = path.join(dirPath, filePath);

                    return this.uploadFile(bucket, sourcePath, keyPrefix + filePath, opts);
                },
                {concurrency},
            );
        },

        deleteObject(bucket: string, key: string) {
            return s3Client.send(new DeleteObjectCommand({Bucket: bucket, Key: key}));
        },
    };
}

async function detectContentTypeFromBuffer(buffer: Buffer) {
    const {fileTypeFromBuffer} = await import('file-type');
    const type = await fileTypeFromBuffer(buffer);

    if (!type) {
        throw Error('Cannot detect content type for buffer');
    }

    let contentType = type.mime;

    // use default charset for content type
    const charset = mime.charset(contentType);
    if (charset) {
        contentType += `; charset=${charset.toLowerCase()}`;
    }

    return contentType;
}

function detectContentTypeFromExt(filePath: string) {
    // Compressed file Content-type must be the same as original file Content-type
    const filename =
        filePath.endsWith('.br') || filePath.endsWith('.gz') ? filePath.slice(0, -3) : filePath;

    let contentType = mime.lookup(filename);

    if (!contentType) {
        throw Error(`Cannot detect content type for file ${filePath}`);
    }

    // use default charset for content type
    const charset = mime.charset(contentType);
    if (charset) {
        contentType += `; charset=${charset.toLowerCase()}`;
    }

    return contentType;
}

interface UploadOptionsCommon {
    expires?: PutObjectCommandInput['Expires'];
    meta?: PutObjectCommandInput['Metadata'];
    cacheControl?: PutObjectCommandInput['CacheControl'];
}

export interface S3UploadDirOptions extends UploadOptionsCommon {
    concurrency?: number;
}

export interface S3UploadFileOptions extends UploadOptionsCommon {
    contentType?: string;
    contentEncoding?: string;
}
