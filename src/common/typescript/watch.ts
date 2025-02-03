import type Typescript from 'typescript';
import type {Logger} from '../logger';
import {createTransformPathsToLocalModules} from './transformers';
import {displayFilename, getTsProjectConfigPath, onHostEvent} from './utils';
import {formatDiagnosticBrief} from './diagnostic';

export function watch(
    ts: typeof Typescript,
    projectPath: string,
    {
        logger,
        onAfterFilesEmitted,
        enableSourceMap,
    }: {logger: Logger; onAfterFilesEmitted?: () => void; enableSourceMap?: boolean},
) {
    logger.message('Start compilation in watch mode');
    logger.message(`Typescript v${ts.version}`);
    const configPath = getTsProjectConfigPath(ts, projectPath);

    const createProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram;

    const host = ts.createWatchCompilerHost(
        configPath,
        {
            noEmit: false,
            noEmitOnError: false,
            inlineSourceMap: enableSourceMap,
            inlineSources: enableSourceMap,
            ...(enableSourceMap ? {sourceMap: false} : undefined),
        },
        ts.sys,
        createProgram,
        reportDiagnostic,
        reportWatchStatusChanged,
    );

    host.readFile = displayFilename(host.readFile, 'Reading', logger);

    onHostEvent(
        host,
        'createProgram',
        () => {
            logger.verbose("We're about to create the program");
            // @ts-expect-error
            host.readFile.enableDisplay();
        },
        () => {
            // @ts-expect-error
            const count = host.readFile.disableDisplay();
            logger.verbose(`Program created, read ${count} files`);
        },
    );

    onHostEvent(
        host,
        'afterProgramCreate',
        (program) => {
            logger.verbose('We finished making the program! Emitting...');
            const transformPathsToLocalModules = createTransformPathsToLocalModules(ts);
            program.emit(undefined, undefined, undefined, undefined, {
                after: [transformPathsToLocalModules],
                afterDeclarations: [transformPathsToLocalModules],
            });
            logger.verbose('Emit completed!');
        },
        () => {
            onAfterFilesEmitted?.();
        },
    );

    // `createWatchProgram` creates an initial program, watches files, and updates
    // the program over time.
    ts.createWatchProgram(host);

    function reportDiagnostic(diagnostic: Typescript.Diagnostic) {
        const formatHost = {
            getCanonicalFileName: (path: string) => path,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getNewLine: () => ts.sys.newLine,
        };
        if (logger.isVerbose) {
            logger.message(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatHost));
        } else {
            logger.message(formatDiagnosticBrief(ts, diagnostic, formatHost));
        }
    }

    /*
     * Prints a diagnostic every time the watch status changes.
     * This is mainly for messages like "Starting compilation" or "Compilation completed".
     */
    function reportWatchStatusChanged(diagnostic: Typescript.Diagnostic) {
        if (diagnostic.messageText) {
            logger.message(ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine));
        }
    }
}
