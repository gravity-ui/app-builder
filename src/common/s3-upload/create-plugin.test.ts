import {createS3UploadPlugins} from './create-plugin';
import {S3UploadPlugin} from './webpack-plugin';

import type {NormalizedClientConfig} from '../models';

jest.mock('./webpack-plugin');

const mockedS3UploadPlugin = jest.mocked(S3UploadPlugin);

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
