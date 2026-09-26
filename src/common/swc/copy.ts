import path from 'node:path';
import chokidar from 'chokidar';
import fastGlob from 'fast-glob';
import fs from 'fs-extra';

import type {Logger} from '../logger/index.js';
import {isExcluded} from './utils.js';

export interface CopyFilesOptions {
    filenames: string[];
    extensions: string[];
    exclude?: string | string[];
    ignore: string[];
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

export async function copyFiles(
    {filenames, extensions, exclude, ignore, outputPath, stripLeadingPaths}: CopyFilesOptions,
    logger: Logger,
) {
    const patterns = await Promise.all(
        filenames.map(async (filename) => {
            const stats = await fs.stat(filename).catch((error: NodeJS.ErrnoException) => {
                if (error.code === 'ENOENT') {
                    return undefined;
                }
                throw error;
            });
            const pattern = fastGlob.convertPathToPattern(filename);
            if (stats?.isDirectory()) {
                return extensions.map((extension) => `${pattern}/**/*${extension}`);
            }
            return stats?.isFile() && extensions.some((extension) => filename.endsWith(extension))
                ? [pattern]
                : [];
        }),
    );
    const files = await fastGlob(patterns.flat(), {ignore: ['**/node_modules/**', ...ignore]});
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
    const isOutput = (file: string) => {
        const relativePath = path.relative(outputPath, path.resolve(file));
        return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
    };
    const copy = async (file: string) => {
        try {
            await fs.copy(file, getDest(file, outputPath, stripLeadingPaths));
            logger.message(`Successfully copied ${file}`);
        } catch (error) {
            logger.error(`Failed to copy ${file}: ${error}`);
        }
    };
    const remove = async (file: string) => {
        try {
            await fs.rm(getDest(file, outputPath, stripLeadingPaths), {force: true});
        } catch (error) {
            logger.error(`Failed to remove the copy of ${file}: ${error}`);
        }
    };
    return chokidar
        .watch(filenames, {
            ignoreInitial: true,
            // The same settings as the @swc/cli watcher, so a file is copied once it is fully written.
            awaitWriteFinish: {stabilityThreshold: 50, pollInterval: 10},
            ignored: (file, stats) => {
                if (path.basename(file).startsWith('.') || isOutput(file)) {
                    return true;
                }
                return stats?.isDirectory()
                    ? isExcluded(`${file}/`, exclude)
                    : isExcluded(file, exclude) ||
                          Boolean(
                              stats && !extensions.some((extension) => file.endsWith(extension)),
                          );
            },
        })
        .on('add', copy)
        .on('change', copy)
        .on('unlink', remove)
        .on('error', (error) => logger.error(`Failed to watch copied files: ${error}`));
}
