import {getS3Client} from './s3-client';
import {uploadFiles} from './upload';

import type {Logger} from '../logger';

jest.mock('./s3-client');
jest.mock('p-queue', () => ({
    __esModule: true,
    default: class {
        add<T>(task: () => T | PromiseLike<T>) {
            return Promise.resolve().then(task);
        }
    },
}));

const mockedGetS3Client = jest.mocked(getS3Client);

const headObject = jest.fn();
const uploadFile = jest.fn();

const logger = {
    verbose: jest.fn(),
    message: jest.fn(),
    error: jest.fn(),
} as unknown as Logger;

function createConfig() {
    return {
        s3: {},
        concurrency: 1,
        options: {
            bucket: 'bucket',
            sourcePath: '/build',
        },
        logger,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedGetS3Client.mockReturnValue({
        headObject,
        uploadFile,
        uploadDir: jest.fn(),
        deleteObject: jest.fn(),
    } as unknown as ReturnType<typeof getS3Client>);
    uploadFile.mockResolvedValue({});
});

describe('uploadFiles', () => {
    it.each([{$metadata: {httpStatusCode: 404}}, {name: 'NotFound'}, {name: 'NoSuchKey'}])(
        'uploads a file when HeadObject reports that it does not exist',
        async (error) => {
            headObject.mockRejectedValueOnce(error);

            await expect(uploadFiles(['file.txt'], createConfig())).resolves.toEqual(['file.txt']);
            expect(uploadFile).toHaveBeenCalledTimes(1);
        },
    );

    it('propagates HeadObject errors other than not found', async () => {
        const error = Object.assign(new Error('Forbidden'), {
            name: 'AccessDenied',
            $metadata: {httpStatusCode: 403},
        });
        headObject.mockRejectedValueOnce(error);

        await expect(uploadFiles(['file.txt'], createConfig())).rejects.toBe(error);
        expect(uploadFile).not.toHaveBeenCalled();
    });

    it('builds an S3 key from the target prefix and a relative file path', async () => {
        headObject.mockRejectedValueOnce({name: 'NotFound'});

        await uploadFiles(['/build/assets/file.txt'], {
            ...createConfig(),
            options: {
                ...createConfig().options,
                targetPath: 'releases/current',
            },
        });

        expect(headObject).toHaveBeenCalledWith('bucket', 'releases/current/assets/file.txt');
        expect(uploadFile).toHaveBeenCalledWith(
            'bucket',
            '/build/assets/file.txt',
            'releases/current/assets/file.txt',
            {cacheControl: undefined},
        );
    });

    it.each(['../outside.txt', '/outside.txt'])(
        'rejects a file outside of sourcePath: %s',
        async (filePath) => {
            await expect(uploadFiles([filePath], createConfig())).rejects.toThrow(
                `File ${filePath} is outside of source path /build`,
            );
            expect(headObject).not.toHaveBeenCalled();
            expect(uploadFile).not.toHaveBeenCalled();
        },
    );

    it.each([
        ['file.js.gz', 'gzip'],
        ['file.js.br', 'br'],
    ])('sets Content-Encoding when uploading %s', async (filePath, contentEncoding) => {
        headObject.mockRejectedValueOnce({name: 'NotFound'});

        await uploadFiles([filePath], createConfig());

        expect(uploadFile).toHaveBeenCalledWith('bucket', `/build/${filePath}`, filePath, {
            cacheControl: undefined,
            contentEncoding,
        });
    });
});
