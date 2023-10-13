import {createReadStream, createWriteStream} from 'node:fs';

import {createBrotliCompress, createGzip} from 'zlib';

import type {Transform} from 'stream';

function compressor(
    sourcePath: string,
    destinationPath: string,
    transformer: Transform,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const sourceStream = createReadStream(sourcePath);
        sourceStream.on('error', reject);

        const destinationStream = createWriteStream(destinationPath);
        destinationStream.on('finish', () => resolve(destinationPath));
        destinationStream.on('error', reject);

        sourceStream.pipe(transformer).pipe(destinationStream);
    });
}

export function gzip(sourcePath: string) {
    return compressor(sourcePath, `${sourcePath}.gz`, createGzip({}));
}

export function brotli(sourcePath: string) {
    return compressor(sourcePath, `${sourcePath}.br`, createBrotliCompress());
}
