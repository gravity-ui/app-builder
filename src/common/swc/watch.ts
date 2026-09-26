import type {Logger} from '../logger/index.js';
import type {ServerConfig} from '../models/index.js';
import {copyFiles, watchCopiedFiles} from './copy.js';
import {getIgnoredGlobs, getSwcOptions, loadSwcCli} from './utils.js';
import type {GetSwcOptionsParams} from './utils.js';

type SwcWatchOptions = NonNullable<ServerConfig['swcOptions']> &
    Pick<GetSwcOptionsParams, 'publicPath'> & {
        outputPath: string;
        logger: Logger;
        onAfterFilesEmitted?: () => void;
    };

export async function watch(
    projectPath: string,
    {
        outputPath,
        logger,
        onAfterFilesEmitted,
        additionalPaths,
        exclude,
        publicPath,
        rootDir,
        copyExtensions,
    }: SwcWatchOptions,
) {
    logger.message('Start compilation in watch mode');
    const {swcOptions, directoriesToCompile} = getSwcOptions({
        projectPath,
        additionalPaths,
        exclude,
        publicPath,
    });

    const {swcDir, sourceOptions} = await loadSwcCli(directoriesToCompile, rootDir);
    const ignore = await getIgnoredGlobs(sourceOptions.filenames, swcOptions.exclude, outputPath);
    const cliOptions = {
        ...sourceOptions,
        ignore,
        outDir: outputPath,
        watch: true,
        sync: false,
        logWatchCompilation: true,
    };

    if (copyExtensions?.length) {
        const copyOptions = {
            ...sourceOptions,
            extensions: copyExtensions,
            exclude: swcOptions.exclude,
            ignore,
            outputPath,
        };
        await copyFiles(copyOptions, logger);
        watchCopiedFiles(copyOptions, logger);
    }

    const callbacks = {
        onSuccess: (result: any) => {
            if (result.filename) {
                logger.message(`Successfully compiled ${result.filename} in ${result.duration}ms`);
            } else {
                logger.message(
                    `Successfully compiled ${result.compiled || 0} files in ${result.duration}ms`,
                );
            }
            onAfterFilesEmitted?.();
        },
        onFail: (result: any) => {
            logger.error(`Compilation failed in ${result.duration}ms`);
            if (result.reasons) {
                for (const [filename, error] of result.reasons) {
                    logger.error(`${filename}: ${error}`);
                }
            }
        },
        onWatchReady: () => {
            logger.message('Watching for file changes');
        },
    };

    swcDir({
        cliOptions,
        swcOptions,
        callbacks,
    });
}
