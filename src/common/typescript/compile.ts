import type Typescript from 'typescript';
import type {Logger} from '../logger';
import {displayFilename, getProjectConfig} from './utils';
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
    const configPath = getProjectConfig(ts, projectPath, configFileName);

    const formatHost = {
        getCanonicalFileName: (path: string) => path,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => ts.sys.newLine,
    };

    const parseConfigFileHost: Typescript.ParseConfigFileHost = {
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        readDirectory: ts.sys.readDirectory,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        onUnRecoverableConfigFileDiagnostic: reportDiagnostic,
    };

    const parsedConfig = ts.getParsedCommandLineOfConfigFile(
        configPath,
        {noEmitOnError: true, ...optionsToExtend},
        parseConfigFileHost,
    );

    if (!parsedConfig) {
        throw new Error(`Invalid '${configFileName}'`);
    }
    logger.verbose('Config found and parsed');

    logger.verbose("We're about to create the program");
    const compilerHost = ts.createCompilerHost(parsedConfig.options);
    compilerHost.readFile = displayFilename(compilerHost.readFile, 'Reading', logger);
    // @ts-ignore
    compilerHost.readFile.enableDisplay();
    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options, compilerHost);
    // @ts-ignore
    const filesCount = compilerHost.readFile.disableDisplay();
    const allDiagnostics = ts.getPreEmitDiagnostics(program).slice();
    logger.verbose(`Program created, read ${filesCount} files`);

    if (!hasErrors(allDiagnostics)) {
        logger.verbose('We finished making the program! Emitting...');
        const transformPathsToLocalModules = createTransformPathsToLocalModules(ts);
        const emitResult = program.emit(undefined, undefined, undefined, undefined, {
            after: [transformPathsToLocalModules],
            afterDeclarations: [transformPathsToLocalModules],
        });
        logger.verbose('Emit complete!');

        allDiagnostics.push(...emitResult.diagnostics);
    }

    allDiagnostics.forEach(reportDiagnostic);

    if (hasErrors(allDiagnostics)) {
        logger.error(`Error compile, elapsed time ${elapsedTime(start)}`);
        process.exit(1);
    } else {
        logger.success(`Compiled successfully in ${elapsedTime(start)}`);
    }

    function reportDiagnostic(diagnostic: Typescript.Diagnostic) {
        if (logger.isVerbose) {
            logger.message(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatHost));
        } else {
            logger.message(formatDiagnosticBrief(ts, diagnostic, formatHost));
        }
    }

    function hasErrors(diagnostics: Typescript.Diagnostic[]) {
        return diagnostics.some(({category}) => category === ts.DiagnosticCategory.Error);
    }
}
