import {jest} from '@jest/globals';

import type {NormalizedClientConfig} from '../models/index.js';
import type {S3UploadPlugin} from './webpack-plugin.js';

const mockedS3UploadPlugin =
    jest.fn<(...args: ConstructorParameters<typeof S3UploadPlugin>) => S3UploadPlugin>();

jest.unstable_mockModule('./webpack-plugin.js', () => ({
    S3UploadPlugin: mockedS3UploadPlugin,
}));

const {createS3UploadPlugins} = await import('./create-plugin.js');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('createS3UploadPlugins', () => {
    it.each([
        [undefined, 5],
        [8, 8],
    ])('passes maxAttempts %s as %s to the S3 client', (configured, expected) => {
        createS3UploadPlugins({
            cdn: {
                bucket: 'bucket',
                maxAttempts: configured,
            },
        } as NormalizedClientConfig);

        expect(mockedS3UploadPlugin).toHaveBeenCalledTimes(1);
        expect(mockedS3UploadPlugin.mock.calls[0]?.[0].s3ClientOptions).toEqual(
            expect.objectContaining({maxAttempts: expected}),
        );
    });

    it.each([
        [undefined, 'adaptive'],
        ['standard', 'standard'],
    ])('passes retryMode %s as %s to the S3 client', (configured, expected) => {
        createS3UploadPlugins({
            cdn: {
                bucket: 'bucket',
                retryMode: configured,
            },
        } as NormalizedClientConfig);

        expect(mockedS3UploadPlugin).toHaveBeenCalledTimes(1);
        expect(mockedS3UploadPlugin.mock.calls[0]?.[0].s3ClientOptions).toEqual(
            expect.objectContaining({retryMode: expected}),
        );
    });
});
