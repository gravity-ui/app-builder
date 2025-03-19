"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gzip = gzip;
exports.brotli = brotli;
const node_fs_1 = require("node:fs");
const zlib_1 = require("zlib");
function compressor(sourcePath, destinationPath, transformer) {
    return new Promise((resolve, reject) => {
        const sourceStream = (0, node_fs_1.createReadStream)(sourcePath);
        sourceStream.on('error', reject);
        const destinationStream = (0, node_fs_1.createWriteStream)(destinationPath);
        destinationStream.on('finish', () => resolve(destinationPath));
        destinationStream.on('error', reject);
        sourceStream.pipe(transformer).pipe(destinationStream);
    });
}
function gzip(sourcePath) {
    return compressor(sourcePath, `${sourcePath}.gz`, (0, zlib_1.createGzip)({}));
}
function brotli(sourcePath) {
    return compressor(sourcePath, `${sourcePath}.br`, (0, zlib_1.createBrotliCompress)());
}
