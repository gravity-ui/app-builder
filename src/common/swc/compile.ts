import type {Logger} from '../logger/index.js';
import {elapsedTime} from '../logger/pretty-time.js';
import type {ServerConfig} from '../models/index.js';
import {copyFiles} from './copy.js';
import {getSwcOptions, loadSwcCli} from './utils.js';
import type {GetSwcOptionsParams} from './utils.js';

type SwcCompileOptions = NonNullable<ServerConfig['swcOptions']> &
    Pick<GetSwcOptionsParams, 'publicPath'> & {
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

    const {swcDir, sourceOptions} = await loadSwcCli(directoriesToCompile, rootDir);
    const cliOptions = {
        ...sourceOptions,
        outDir: outputPath,
        watch: false,
        sync: false,
    };

    if (copyExtensions?.length) {
        await copyFiles(
            {...sourceOptions, extensions: copyExtensions, exclude: swcOptions.exclude, outputPath},
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
