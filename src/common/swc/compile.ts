import type {Logger} from '../logger';
import {elapsedTime} from '../logger/pretty-time';
// @ts-ignore @swc/cli is not typed
import {swcDir} from '@swc/cli';
import {EXTENSIONS_TO_COMPILE, getSwcOptions} from './utils';
import type {GetSwcOptionsParams} from './utils';

type SwcCompileOptions = Pick<GetSwcOptionsParams, 'additionalPaths' | 'exclude' | 'publicPath'> & {
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
        outDir: outputPath,
        watch: false,
        extensions: EXTENSIONS_TO_COMPILE,
        stripLeadingPaths: true,
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
