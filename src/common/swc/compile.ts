import type {Logger} from '../logger/index.js';
import {elapsedTime} from '../logger/pretty-time.js';
// @ts-ignore @swc/cli is not typed
import {swcDir} from '@swc/cli';
import {EXTENSIONS_TO_COMPILE, getIgnoreGlobs, getOutputOptions, getSwcOptions} from './utils.js';
import type {GetSwcOptionsParams} from './utils.js';

type SwcCompileOptions = Pick<GetSwcOptionsParams, 'additionalPaths' | 'exclude' | 'publicPath'> & {
    rootDir?: string;
    copyFiles?: boolean;
    ignore?: string[];
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
    copyFiles,
    ignore,
}: SwcCompileOptions): Promise<void> {
    const start = process.hrtime.bigint();
    logger.message('Start compilation');

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
        watch: false,
        extensions: EXTENSIONS_TO_COMPILE,
        sync: false,
    };

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
