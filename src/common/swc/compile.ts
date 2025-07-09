import type {Logger} from '../logger';
import {elapsedTime} from '../logger/pretty-time';
import {Options} from '@swc/core';

const getSwcConfig = (enableSourceMap = false): Options => {
    return {
        module: {
            type: 'commonjs',
        },
        jsc: {
            target: 'es2020',
            parser: {
                syntax: 'typescript',
            },
        },
        sourceMaps: enableSourceMap,
    };
};

interface SwcCompileOptions {
    projectPath: string;
    outputPath: string;
    logger: Logger;
    enableSourceMap?: boolean;
}

export async function compile(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    swcDir: any,
    {projectPath, outputPath, logger, enableSourceMap = false}: SwcCompileOptions,
): Promise<void> {
    const start = process.hrtime.bigint();
    logger.message('Start compilation');

    const swcConfig = getSwcConfig(enableSourceMap);

    const cliOptions = {
        filenames: [projectPath],
        outDir: outputPath,
        watch: false,
        sourceMaps: enableSourceMap,
        extensions: ['.js', '.ts', '.mjs', '.cjs'],
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
                swcOptions: swcConfig,
                callbacks,
            });
        } catch (error) {
            logger.error(`Failed to start compilation: ${error}`);
            reject(error);
        }
    });
}
