import type {Logger} from '../logger';
// @ts-ignore @swc/cli is not typed
import {swcDir} from '@swc/cli';
import {getSwcOptionsFromTsconfig} from './utils';

interface SwcWatchOptions {
    outputPath: string;
    logger: Logger;
    onAfterFilesEmitted?: () => void;
}

export async function watch(
    projectPath: string,
    {outputPath, logger, onAfterFilesEmitted}: SwcWatchOptions,
) {
    logger.message('Start compilation in watch mode');
    const swcOptions = getSwcOptionsFromTsconfig(projectPath);

    const cliOptions = {
        filenames: [projectPath],
        outDir: outputPath,
        watch: true,
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
        swcOptions,
        callbacks,
    });
}
