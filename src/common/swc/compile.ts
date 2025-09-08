import type {Logger} from '../logger';
import {elapsedTime} from '../logger/pretty-time';
// @ts-ignore @swc/cli is not typed
import {swcDir} from '@swc/cli';
import {EXTENSIONS_TO_COMPILE, getSwcOptionsFromTsconfig} from './utils';
import type {GetSwcOptionsFromTsconfigOptions} from './utils';

type SwcCompileOptions = Pick<GetSwcOptionsFromTsconfigOptions, 'additionalPaths' | 'exclude'> & {
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
}: SwcCompileOptions): Promise<void> {
    const start = process.hrtime.bigint();
    logger.message('Start compilation');

    const {swcOptions, directoriesToCompile} = getSwcOptionsFromTsconfig({
        projectPath,
        additionalPaths,
        exclude,
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
