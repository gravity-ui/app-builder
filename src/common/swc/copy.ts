import path from 'node:path';
import chokidar from 'chokidar';
import fastGlob from 'fast-glob';
import fs from 'fs-extra';

import type {Logger} from '../logger/index.js';

export interface CopyFilesOptions {
    filenames: string[];
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

export async function copyFiles(
    {filenames, extensions, exclude, outputPath, stripLeadingPaths}: CopyFilesOptions,
    logger: Logger,
) {
    const files = await fastGlob(
        filenames.flatMap((directory) =>
            extensions.map(
                (extension) => `${fastGlob.convertPathToPattern(directory)}/**/*${extension}`,
            ),
        ),
        {ignore: ['**/node_modules/**']},
    );
    const filesToCopy = files.filter((file) => !isExcluded(file, exclude));
    await Promise.all(
        filesToCopy.map((file) => fs.copy(file, getDest(file, outputPath, stripLeadingPaths))),
    );
    logger.message(`Copied ${filesToCopy.length} files`);
}

export function watchCopiedFiles(
    {filenames, extensions, exclude, outputPath, stripLeadingPaths}: CopyFilesOptions,
    logger: Logger,
) {
    const copy = async (file: string) => {
        try {
            await fs.copy(file, getDest(file, outputPath, stripLeadingPaths));
            logger.message(`Successfully copied ${file}`);
        } catch (error) {
            logger.error(`Failed to copy ${file}: ${error}`);
        }
    };
    return chokidar
        .watch(filenames, {
            ignoreInitial: true,
            ignored: (file, stats) =>
                stats?.isDirectory()
                    ? isExcluded(`${file}/`, exclude)
                    : isExcluded(file, exclude) ||
                      Boolean(stats && !extensions.some((extension) => file.endsWith(extension))),
        })
        .on('add', copy)
        .on('change', copy)
        .on('unlink', (file) => fs.rm(getDest(file, outputPath, stripLeadingPaths), {force: true}));
}
