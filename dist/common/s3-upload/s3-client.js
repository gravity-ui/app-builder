"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getS3Client = getS3Client;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("node:path"));
const client_s3_1 = require("@aws-sdk/client-s3");
const mime = __importStar(require("mime-types"));
const fast_glob_1 = require("fast-glob");
function getS3Client(options) {
    const s3Client = new client_s3_1.S3Client(options);
    return {
        headObject(bucket, key) {
            return s3Client.send(new client_s3_1.HeadObjectCommand({ Bucket: bucket, Key: key }));
        },
        async uploadFile(bucket, localFileOrPath, key, opts = {}) {
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
            const params = {
                Bucket: bucket,
                Key: key,
                Body: bodyBuffer,
                Metadata: meta,
                Expires: expires,
                ContentEncoding: contentEncoding,
                ContentType: contentType,
            };
            if (expires) {
                params.Metadata = { ...params.Metadata, Expires: expires.toString() };
            }
            if (opts.cacheControl) {
                params.CacheControl = opts.cacheControl;
            }
            return s3Client.send(new client_s3_1.PutObjectCommand(params));
        },
        async uploadDir(bucket, dirPath, keyPrefix = '', { concurrency = 512, ...opts } = {}) {
            const files = (0, fast_glob_1.globSync)('**', { cwd: dirPath });
            const { default: pMap } = await import('p-map');
            return pMap(files, (filePath) => {
                const sourcePath = path.join(dirPath, filePath);
                return this.uploadFile(bucket, sourcePath, keyPrefix + filePath, opts);
            }, { concurrency });
        },
        deleteObject(bucket, key) {
            return s3Client.send(new client_s3_1.DeleteObjectCommand({ Bucket: bucket, Key: key }));
        },
    };
}
async function detectContentTypeFromBuffer(buffer) {
    const { fileTypeFromBuffer } = await import('file-type');
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
function detectContentTypeFromExt(filePath) {
    // Compressed file Content-type must be the same as original file Content-type
    const filename = filePath.endsWith('.br') || filePath.endsWith('.gz') ? filePath.slice(0, -3) : filePath;
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
