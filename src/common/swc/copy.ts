import fs from 'node:fs';
import path from 'node:path';
import fastGlob from 'fast-glob';

import type {Logger} from '../logger/index.js';

export interface CopyFilesOptions {
    directories: string[];
    extensions: string[];
    exclude?: string | string[];
    outputPath: string;
    stripLeadingPaths: boolean;
}

// Mirrors how @swc/cli places compiled files, so copies land next to them.
function getDest(file: string, outputPath: string, stripLeadingPaths: boolean) {
    let segments = path.relative(process.cwd(), file).split(path.sep);
    if (stripLeadingPaths && segments.length > 1) {
        segments = segments.slice(1);
        while (segments[0] === '..') {
            segments.shift();
        }
    }
    return path.join(outputPath, ...segments);
}

function isExcluded(file: string, exclude: CopyFilesOptions['exclude'] = []) {
    // eslint-disable-next-line security/detect-non-literal-regexp
    return [exclude].flat().some((pattern) => new RegExp(pattern).test(file));
}

async function copyFile(file: string, dest: string) {
    await fs.promises.mkdir(path.dirname(dest), {recursive: true});
    await fs.promises.copyFile(file, dest);
}

export async function copyFiles(
    {directories, extensions, exclude, outputPath, stripLeadingPaths}: CopyFilesOptions,
    logger: Logger,
) {
    const files = await fastGlob(
        directories.flatMap((directory) =>
            extensions.map(
                (extension) => `${fastGlob.convertPathToPattern(directory)}/**/*${extension}`,
            ),
        ),
        {ignore: ['**/node_modules/**']},
    );
    const filesToCopy = files.filter((file) => !isExcluded(file, exclude));
    await Promise.all(
        filesToCopy.map((file) => copyFile(file, getDest(file, outputPath, stripLeadingPaths))),
    );
    logger.message(`Copied ${filesToCopy.length} files`);
}

export function watchCopiedFiles(
    {directories, extensions, exclude, outputPath, stripLeadingPaths}: CopyFilesOptions,
    logger: Logger,
) {
    return directories.map((directory) =>
        fs.watch(directory, {recursive: true}, async (_event, filename) => {
            if (!filename || !extensions.some((extension) => filename.endsWith(extension))) {
                return;
            }
            const file = path.join(directory, filename);
            if (isExcluded(file, exclude)) {
                return;
            }
            const dest = getDest(file, outputPath, stripLeadingPaths);
            try {
                await copyFile(file, dest);
                logger.message(`Successfully copied ${file}`);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    await fs.promises.rm(dest, {force: true});
                } else {
                    logger.error(`Failed to copy ${file}: ${error}`);
                }
            }
        }),
    );
}
