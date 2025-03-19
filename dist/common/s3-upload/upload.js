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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFiles = uploadFiles;
const path = __importStar(require("node:path"));
const index_js_1 = __importDefault(require("../logger/index.js"));
const s3_client_js_1 = require("./s3-client.js");
const compress_js_1 = require("./compress.js");
async function uploadFiles(files, config) {
    const s3Client = (0, s3_client_js_1.getS3Client)(config.s3);
    const log = config.logger ?? index_js_1.default;
    const { default: PQueue } = await import('p-queue');
    const queue = new PQueue({
        concurrency: config.concurrency ?? 512,
    });
    const processFile = fileProcessor(config.options);
    return Promise.all(files.flatMap((filePath) => {
        const relativeFilePath = path.isAbsolute(filePath)
            ? path.relative(config.options.sourcePath, filePath)
            : filePath;
        return processFile(relativeFilePath);
    }));
    function doesExist(bucket, key) {
        return queue
            .add(() => s3Client.headObject(bucket, key))
            .then(() => true)
            .catch(() => false);
    }
    function uploadFile(bucket, sourceFilePath, targetFilePath, options) {
        return queue.add(() => s3Client.uploadFile(bucket, sourceFilePath, targetFilePath, options));
    }
    function fileUploader(options) {
        return async (relativeFilePath) => {
            const sourceFilePath = path.join(options.sourcePath, relativeFilePath);
            const targetFilePath = path.join(options.targetPath || '', relativeFilePath);
            log.verbose(`Uploading file ${relativeFilePath} ...`);
            const exists = await doesExist(options.bucket, targetFilePath);
            if (exists) {
                switch (options.existsBehavior) {
                    case 'overwrite': {
                        log.verbose(`File ${targetFilePath} will be overwritten.`);
                        break;
                    }
                    case 'throw': {
                        throw new Error(`File ${targetFilePath} already exists in ${options.bucket}`);
                    }
                    default: {
                        log.message(`Nothing to do with '${relativeFilePath}' because '${targetFilePath}' already exists in '${options.bucket}'`);
                        return Promise.resolve(relativeFilePath);
                    }
                }
            }
            const cacheControl = typeof options.cacheControl === 'function'
                ? options.cacheControl(targetFilePath)
                : options.cacheControl;
            return uploadFile(options.bucket, sourceFilePath, targetFilePath, {
                cacheControl,
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
    function compress(sourcePath) {
        // throwOnTimeout is only used to get the correct type and does not change behavior since we are not setting a timeout.
        return [
            queue.add(() => (0, compress_js_1.gzip)(sourcePath), { throwOnTimeout: true }),
            queue.add(() => (0, compress_js_1.brotli)(sourcePath), { throwOnTimeout: true }),
        ];
    }
    function fileProcessor(options) {
        return (relativeFilePath) => {
            const upload = fileUploader(options);
            const filesPromises = [upload(relativeFilePath)];
            if (config.compress && shouldCompress(relativeFilePath)) {
                const sourcePath = path.join(options.sourcePath, relativeFilePath);
                filesPromises.push(...compress(sourcePath).map((promise) => {
                    return promise.then((compressedFile) => {
                        const relativeCompressedFilePath = path.relative(options.sourcePath, compressedFile);
                        return upload(relativeCompressedFilePath);
                    });
                }));
            }
            return filesPromises;
        };
    }
}
const NOT_COMPRESS = ['png', 'zip', 'gz', 'br'];
function shouldCompress(filePath) {
    const fileName = path.basename(filePath);
    const extension = fileName.split('.').pop();
    return !NOT_COMPRESS.includes(extension);
}
