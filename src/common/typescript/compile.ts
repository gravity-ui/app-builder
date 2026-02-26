import type Typescript from 'typescript';
import type {Logger} from '../logger';
import {displayFilename, getTsProjectConfigPath} from './utils';
import {createTransformPathsToLocalModules} from './transformers';
import {elapsedTime} from '../logger/pretty-time';
import {formatDiagnosticBrief} from './diagnostic';

interface CompileOptions {
    projectPath: string;
    configFileName?: string;
    logger: Logger;
}

export function compile(
    ts: typeof Typescript,
    {projectPath, configFileName = 'tsconfig.json', logger}: CompileOptions,
) {
    const start = process.hrtime.bigint();
    logger.message('Start compilation');
    logger.message(`Typescript v${ts.version}`);

    logger.verbose(`Searching for the ${configFileName} in ${projectPath}`);

    logger.verbose('Config found and parsed');

    logger.verbose("We're about to create the program");
    const compilerHost = ts.createSolutionBuilderHost(
        ts.sys,
        ts.createEmitAndSemanticDiagnosticsBuilderProgram,
        reportDiagnostic,
        reportDiagnostic,
    );
    compilerHost.readFile = displayFilename(compilerHost.readFile, 'Reading', logger);
    // @ts-expect-error We invoke method from overrided function
    compilerHost.readFile.enableDisplay();
    const solutionBuilder = ts.createSolutionBuilder(
        compilerHost,
        [getTsProjectConfigPath(ts, projectPath, configFileName)],
        {noEmitOnError: true},
    );
    // @ts-expect-error We invoke method from overrided function
    const filesCount = compilerHost.readFile.disableDisplay();
    logger.verbose(`Program created, read ${filesCount} files`);

    logger.verbose('We finished making the program! Emitting...');
    const transformPathsToLocalModules = createTransformPathsToLocalModules(ts);

    let project = solutionBuilder.getNextInvalidatedProject();
    do {
        if (project?.kind === ts.InvalidatedProjectKind.Build) {
            const emitResult = project.emit(undefined, undefined, undefined, undefined, {
                after: [transformPathsToLocalModules],
                afterDeclarations: [transformPathsToLocalModules],
            });

            if (emitResult?.diagnostics) {
                const diagnostics = ts.sortAndDeduplicateDiagnostics(emitResult?.diagnostics);

                if (hasErrors(diagnostics)) {
                    logger.error(`Error compile, elapsed time ${elapsedTime(start)}`);
                    process.exit(1);
                } else {
                    logger.success(
                        `Compiled successfully ${project.project} in ${elapsedTime(start)}`,
                    );
                }
            }
        }

        project?.done();

        project = solutionBuilder.getNextInvalidatedProject();
    } while (project);

    logger.verbose('Emit complete!');

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

    function hasErrors(diagnostics: readonly Typescript.Diagnostic[]) {
        return diagnostics.some(({category}) => category === ts.DiagnosticCategory.Error);
    }
}
