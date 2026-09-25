import type {Logger} from '../logger/index.js';
import {copyFiles, watchCopiedFiles} from './copy.js';
import {getSwcCliSourceOptions, getSwcOptions, importSwcDir} from './utils.js';
import type {GetSwcOptionsParams, SwcOutputOptions} from './utils.js';

type SwcWatchOptions = Pick<GetSwcOptionsParams, 'additionalPaths' | 'exclude' | 'publicPath'> &
    SwcOutputOptions & {
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

    const swcDir = await importSwcDir(rootDir);
    const sourceOptions = getSwcCliSourceOptions(directoriesToCompile, rootDir);
    const cliOptions = {
        ...sourceOptions,
        outDir: outputPath,
        watch: true,
        sync: false,
        logWatchCompilation: true,
    };

    if (copyExtensions?.length) {
        const copyOptions = {
            directories: sourceOptions.filenames,
            extensions: copyExtensions,
            exclude: swcOptions.exclude,
            outputPath,
            stripLeadingPaths: sourceOptions.stripLeadingPaths,
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
