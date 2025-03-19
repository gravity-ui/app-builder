import type { PutObjectCommandInput, S3ClientConfig } from '@aws-sdk/client-s3';
export type S3ClientOptions = S3ClientConfig;
export declare function getS3Client(options: S3ClientOptions): {
    headObject(bucket: string, key: string): Promise<import("@aws-sdk/client-s3").HeadObjectCommandOutput>;
    uploadFile(bucket: string, localFileOrPath: string | Buffer, key: string, opts?: S3UploadFileOptions): Promise<import("@aws-sdk/client-s3").PutObjectCommandOutput>;
    uploadDir(bucket: string, dirPath: string, keyPrefix?: string, { concurrency, ...opts }?: S3UploadDirOptions): Promise<import("@aws-sdk/client-s3").PutObjectCommandOutput[]>;
    deleteObject(bucket: string, key: string): Promise<import("@aws-sdk/client-s3").DeleteObjectCommandOutput>;
};
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
export {};
