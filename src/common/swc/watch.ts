import type {Logger} from '../logger/index.js';
import type {ServerConfig} from '../models/index.js';
import {getSwcOptions, loadSwcCli} from './utils.js';
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
        copyFiles,
        ignore: ignoredGlobs = [],
    }: SwcWatchOptions,
) {
    logger.message('Start compilation in watch mode');
    const {swcOptions, directoriesToCompile} = getSwcOptions({
        projectPath,
        additionalPaths,
        exclude,
        publicPath,
    });

    const {swcDir, sourceOptions} = await loadSwcCli(directoriesToCompile, {
        rootDir,
        outputPath,
        exclude: swcOptions.exclude,
        ignore: ignoredGlobs,
    });
    const cliOptions = {
        ...sourceOptions,
        copyFiles: copyFiles ?? false,
        outDir: outputPath,
        watch: true,
        sync: false,
        logWatchCompilation: true,
    };

    const callbacks = {
        onSuccess: (result: any) => {
            if (result.filename) {
                const action = result.copied ? 'copied' : 'compiled';
                logger.message(`Successfully ${action} ${result.filename} in ${result.duration}ms`);
            } else {
                logger.message(
                    `Successfully compiled ${result.compiled || 0} files and copied ${result.copied || 0} files in ${result.duration}ms`,
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
