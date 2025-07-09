import type {Logger} from '../logger';
import {Options} from '@swc/core';

interface SwcWatchOptions {
    outputPath: string;
    logger: Logger;
    onAfterFilesEmitted?: () => void;
    enableSourceMap?: boolean;
}

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

export async function watch(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    swcDir: any,
    projectPath: string,
    {outputPath, logger, onAfterFilesEmitted, enableSourceMap = false}: SwcWatchOptions,
) {
    logger.message('Start compilation in watch mode');
    const swcConfig = getSwcConfig(enableSourceMap);

    const cliOptions = {
        filenames: [projectPath],
        outDir: outputPath,
        watch: true,
        sourceMaps: enableSourceMap,
        extensions: ['.js', '.ts', '.mjs', '.cjs'],
        stripLeadingPaths: true,
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
        swcOptions: swcConfig,
        callbacks,
    });
}
