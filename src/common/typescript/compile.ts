import type Typescript from 'typescript';
import type {Logger} from '../logger';
import {displayFilename, getTsProjectConfig} from './utils';
import {createTransformPathsToLocalModules} from './transformers';
import {elapsedTime} from '../logger/pretty-time';
import {formatDiagnosticBrief} from './diagnostic';

interface CompileOptions {
    projectPath: string;
    configFileName?: string;
    logger: Logger;
    optionsToExtend?: Typescript.CompilerOptions;
}

export function compile(
    ts: typeof Typescript,
    {projectPath, configFileName = 'tsconfig.json', optionsToExtend, logger}: CompileOptions,
) {
    const start = process.hrtime.bigint();
    logger.message('Start compilation');
    logger.message(`Typescript v${ts.version}`);

    logger.verbose(`Searching for the ${configFileName} in ${projectPath}`);
    const parsedConfig = getTsProjectConfig(ts, projectPath, configFileName, {
        noEmit: false,
        noEmitOnError: true,
        ...optionsToExtend,
    });

    logger.verbose('Config found and parsed');

    logger.verbose("We're about to create the program");
    const compilerHost = ts.createCompilerHost(parsedConfig.options);
    compilerHost.readFile = displayFilename(compilerHost.readFile, 'Reading', logger);
    // @ts-expect-error
    compilerHost.readFile.enableDisplay();
    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options, compilerHost);
    // @ts-expect-error
    const filesCount = compilerHost.readFile.disableDisplay();
    let allDiagnostics = ts.getPreEmitDiagnostics(program);
    logger.verbose(`Program created, read ${filesCount} files`);

    if (!hasErrors(allDiagnostics)) {
        logger.verbose('We finished making the program! Emitting...');
        const transformPathsToLocalModules = createTransformPathsToLocalModules(ts);
        const emitResult = program.emit(undefined, undefined, undefined, undefined, {
            after: [transformPathsToLocalModules],
            afterDeclarations: [transformPathsToLocalModules],
        });
        logger.verbose('Emit complete!');

        allDiagnostics = ts.sortAndDeduplicateDiagnostics(
            allDiagnostics.concat(emitResult.diagnostics),
        );
    }

    allDiagnostics.forEach(reportDiagnostic);

    if (hasErrors(allDiagnostics)) {
        logger.error(`Error compile, elapsed time ${elapsedTime(start)}`);
        process.exit(1);
    } else {
        logger.success(`Compiled successfully in ${elapsedTime(start)}`);
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

    function hasErrors(diagnostics: readonly Typescript.Diagnostic[]) {
        return diagnostics.some(({category}) => category === ts.DiagnosticCategory.Error);
    }
}
