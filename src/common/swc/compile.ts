import type {Logger} from '../logger/index.js';
import {elapsedTime} from '../logger/pretty-time.js';
import {copyFiles} from './copy.js';
import {getSwcCliSourceOptions, getSwcOptions, importSwcDir} from './utils.js';
import type {GetSwcOptionsParams, SwcOutputOptions} from './utils.js';

type SwcCompileOptions = Pick<GetSwcOptionsParams, 'additionalPaths' | 'exclude' | 'publicPath'> &
    SwcOutputOptions & {
        projectPath: string;
        outputPath: string;
        logger: Logger;
    };

export async function compile({
    projectPath,
    outputPath,
    logger,
    additionalPaths,
    exclude,
    publicPath,
    rootDir,
    copyExtensions,
}: SwcCompileOptions): Promise<void> {
    const start = process.hrtime.bigint();
    logger.message('Start compilation');

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
        watch: false,
        sync: false,
    };

    if (copyExtensions?.length) {
        await copyFiles(
            {
                directories: sourceOptions.filenames,
                extensions: copyExtensions,
                exclude: swcOptions.exclude,
                outputPath,
                stripLeadingPaths: sourceOptions.stripLeadingPaths,
            },
            logger,
        );
    }

    return new Promise((resolve, reject) => {
        const callbacks = {
            onSuccess: (_result: any) => {
                logger.success(`Compiled successfully in ${elapsedTime(start)}`);
                resolve();
            },
            onFail: (result: any) => {
                logger.error(`Compilation failed in ${result.duration}ms`);
                if (result.reasons) {
                    for (const [filename, error] of result.reasons) {
                        logger.error(`${filename}: ${error}`);
                    }
                }
                logger.error(`Error compile, elapsed time ${elapsedTime(start)}`);
                reject(new Error('Compilation failed'));
            },
        };

        try {
            swcDir({
                cliOptions,
                swcOptions,
                callbacks,
            });
        } catch (error) {
            logger.error(`Failed to start compilation: ${error}`);
            reject(error);
        }
    });
}
