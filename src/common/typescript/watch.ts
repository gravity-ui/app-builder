import type Typescript from 'typescript';
import type {Logger} from '../logger';
import {createTransformPathsToLocalModules} from './transformers';
import {displayFilename, getTsProjectConfigPath, onHostEvent} from './utils';
import {formatDiagnosticBrief} from './diagnostic';

/** @see https://github.com/microsoft/TypeScript/blob/9059e5bda0bb603ae6b41eca09dcd2a071af45fd/src/compiler/diagnosticMessages.json#L5400-L5403 */
const COMPILATION_COMPLETE_WITH_ERROR = 6193;

/** @see https://github.com/microsoft/TypeScript/blob/9059e5bda0bb603ae6b41eca09dcd2a071af45fd/src/compiler/diagnosticMessages.json#L5404-L5407 */
const COMPILATION_COMPLETE_WITH_N_ERRORS = 6194;

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

    const host = ts.createSolutionBuilderWithWatchHost(
        ts.sys,
        createProgram,
        reportDiagnostic,
        reportDiagnostic,
        reportWatchStatusChanged,
    );

    onHostEvent(
        host,
        'createProgram',
        (_rootnames, _options, host) => {
            logger.verbose("We're about to create the program");

            if (host) {
                host.readFile = displayFilename(host.readFile, 'Reading', logger);

                // @ts-expect-error
                host.readFile.enableDisplay();
            }
        },
        (_result, _rootnames, _options, host) => {
            if (host) {
                // @ts-expect-error
                const count = host.readFile.disableDisplay();

                logger.verbose(`Program created, read ${count} files`);
            }
        },
    );

    onHostEvent(host, 'afterProgramEmitAndDiagnostics', (program) => {
        const project = program.getCompilerOptions().configFilePath;

        logger.verbose(
            typeof project === 'string'
                ? `Emit completed for ${project.replace(process.cwd(), '')}!`
                : 'Emit completed!',
        );
    });

    // `createSolutionBuilderWithWatch` creates an initial program, watches files, and updates
    // the program over time.
    const solutionBuilder = ts.createSolutionBuilderWithWatch(host, [configPath], {
        noEmit: false,
        noEmitOnError: false,
        inlineSourceMap: enableSourceMap,
        inlineSources: enableSourceMap,
        ...(enableSourceMap ? {sourceMap: false} : undefined),
    });

    const transformPathsToLocalModules = createTransformPathsToLocalModules(ts);

    solutionBuilder.build(undefined, undefined, undefined, () => ({
        after: [transformPathsToLocalModules],
        afterDeclarations: [transformPathsToLocalModules],
    }));

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

        if (
            diagnostic.code === COMPILATION_COMPLETE_WITH_ERROR ||
            diagnostic.code === COMPILATION_COMPLETE_WITH_N_ERRORS
        ) {
            onAfterFilesEmitted?.();
        }
    }
}
