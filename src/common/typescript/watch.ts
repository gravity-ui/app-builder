import type Typescript from 'typescript';
import type {Logger} from '../logger';
import {createTransformPathsToLocalModules} from './transformers';
import {displayFilename, getTsProjectConfigPath} from './utils';
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

    const host = ts.createSolutionBuilderWithWatchHost(
        ts.sys,
        createProgram,
        reportDiagnostic,
        reportDiagnostic,
        reportWatchStatusChanged,
    );

    const transformPathsToLocalModules = createTransformPathsToLocalModules(ts);

    // `createSolutionBuilderWithWatch` creates an initial program, watches files, and updates
    // the program over time.
    const solutionBuilder = ts.createSolutionBuilderWithWatch(host, [configPath], {
        noEmit: false,
        noEmitOnError: false,
        inlineSourceMap: enableSourceMap,
        inlineSources: enableSourceMap,
        ...(enableSourceMap ? {sourceMap: false} : undefined),
    });

    let project = solutionBuilder.getNextInvalidatedProject();

    do {
        if (project?.kind === ts.InvalidatedProjectKind.Build) {
            const projectConfigPath = project.project.replace(process.cwd(), '');

            const originalReadFile = host.readFile;
            host.readFile = displayFilename(originalReadFile, 'Reading', logger);

            logger.verbose("We're about to create the program");
            // @ts-expect-error We invoke method from overrided function
            host.readFile.enableDisplay();

            const program = project.getProgram();

            if (!program) {
                logger.verbose(`Program was not created, skip emitting for ${projectConfigPath}`);

                // @ts-expect-error We invoke method from overrided function
                host.readFile.disableDisplay();
                host.readFile = originalReadFile;

                logger.verbose(
                    `We finished making the program for ${projectConfigPath}! Emitting...`,
                );

                next();

                continue;
            }

            // @ts-expect-error
            const count = host.readFile.disableDisplay();
            host.readFile = originalReadFile;
            logger.verbose(`Program created, read ${count} files`);

            project.emit(undefined, undefined, undefined, undefined, {
                after: [transformPathsToLocalModules],
                afterDeclarations: [transformPathsToLocalModules],
            });

            logger.verbose('Emit completed!');

            next();
        }
    } while (project);

    onAfterFilesEmitted?.();

    function next() {
        project = solutionBuilder.getNextInvalidatedProject();
    }

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
