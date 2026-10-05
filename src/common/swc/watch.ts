import type {Logger} from '../logger/index.js';
// @ts-ignore @swc/cli is not typed
import {swcDir} from '@swc/cli';
import {EXTENSIONS_TO_COMPILE, getIgnoreGlobs, getOutputOptions, getSwcOptions} from './utils.js';
import type {GetSwcOptionsParams} from './utils.js';

type SwcWatchOptions = Pick<GetSwcOptionsParams, 'additionalPaths' | 'exclude' | 'publicPath'> & {
    rootDir?: string;
    copyFiles?: boolean;
    ignore?: string[];
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
        copyFiles,
        ignore,
    }: SwcWatchOptions,
) {
    logger.message('Start compilation in watch mode');
    const {swcOptions, directoriesToCompile} = getSwcOptions({
        projectPath,
        additionalPaths,
        exclude,
        publicPath,
    });

    const cliOptions = {
        filenames: directoriesToCompile,
        ...getOutputOptions(outputPath, directoriesToCompile, rootDir),
        copyFiles,
        ignore: getIgnoreGlobs(ignore),
        watch: true,
        extensions: EXTENSIONS_TO_COMPILE,
        sync: false,
        logWatchCompilation: true,
    };

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
