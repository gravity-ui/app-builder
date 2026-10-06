import type {Logger} from '../logger/index.js';
// @ts-ignore @swc/cli is not typed
import {swcDir} from '@swc/cli';
import {EXTENSIONS_TO_COMPILE, getIgnoreGlobs, getOutputOptions, getSwcOptions} from './utils.js';
import type {GetSwcOptionsParams} from './utils.js';
import type {ServerConfig} from '../models/index.js';

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
        ignore: getIgnoreGlobs(directoriesToCompile, ignore),
        watch: true,
        extensions: EXTENSIONS_TO_COMPILE,
        sync: false,
        logWatchCompilation: true,
    };

    let reported = false;
    const callbacks = {
        onSuccess: (result: any) => {
            reported = true;
            if (result.filename) {
                const action = result.copied ? 'copied' : 'compiled';
                logger.message(`Successfully ${action} ${result.filename} in ${result.duration}ms`);
            } else {
                logger.message(
                    `Successfully compiled ${result.compiled || 0} and copied ${result.copied || 0} files in ${result.duration}ms`,
                );
            }
            onAfterFilesEmitted?.();
        },
        onFail: (result: any) => {
            reported = true;
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

    await swcDir({
        cliOptions,
        swcOptions,
        callbacks,
    });
    // @swc/cli reports nothing when no files are found.
    if (!reported) {
        throw new Error('No server files were compiled');
    }
}
