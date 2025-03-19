"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compile = compile;
const utils_1 = require("./utils");
const transformers_1 = require("./transformers");
const pretty_time_1 = require("../logger/pretty-time");
const diagnostic_1 = require("./diagnostic");
function compile(ts, { projectPath, configFileName = 'tsconfig.json', optionsToExtend, logger }) {
    const start = process.hrtime.bigint();
    logger.message('Start compilation');
    logger.message(`Typescript v${ts.version}`);
    logger.verbose(`Searching for the ${configFileName} in ${projectPath}`);
    const parsedConfig = (0, utils_1.getTsProjectConfig)(ts, projectPath, configFileName, {
        noEmit: false,
        noEmitOnError: true,
        ...optionsToExtend,
    });
    logger.verbose('Config found and parsed');
    logger.verbose("We're about to create the program");
    const compilerHost = ts.createCompilerHost(parsedConfig.options);
    compilerHost.readFile = (0, utils_1.displayFilename)(compilerHost.readFile, 'Reading', logger);
    // @ts-expect-error
    compilerHost.readFile.enableDisplay();
    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options, compilerHost);
    // @ts-expect-error
    const filesCount = compilerHost.readFile.disableDisplay();
    let allDiagnostics = ts.getPreEmitDiagnostics(program);
    logger.verbose(`Program created, read ${filesCount} files`);
    if (!hasErrors(allDiagnostics)) {
        logger.verbose('We finished making the program! Emitting...');
        const transformPathsToLocalModules = (0, transformers_1.createTransformPathsToLocalModules)(ts);
        const emitResult = program.emit(undefined, undefined, undefined, undefined, {
            after: [transformPathsToLocalModules],
            afterDeclarations: [transformPathsToLocalModules],
        });
        logger.verbose('Emit complete!');
        allDiagnostics = ts.sortAndDeduplicateDiagnostics(allDiagnostics.concat(emitResult.diagnostics));
    }
    allDiagnostics.forEach(reportDiagnostic);
    if (hasErrors(allDiagnostics)) {
        logger.error(`Error compile, elapsed time ${(0, pretty_time_1.elapsedTime)(start)}`);
        process.exit(1);
    }
    else {
        logger.success(`Compiled successfully in ${(0, pretty_time_1.elapsedTime)(start)}`);
    }
    function reportDiagnostic(diagnostic) {
        const formatHost = {
            getCanonicalFileName: (path) => path,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getNewLine: () => ts.sys.newLine,
        };
        if (logger.isVerbose) {
            logger.message(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatHost));
        }
        else {
            logger.message((0, diagnostic_1.formatDiagnosticBrief)(ts, diagnostic, formatHost));
        }
    }
    function hasErrors(diagnostics) {
        return diagnostics.some(({ category }) => category === ts.DiagnosticCategory.Error);
    }
}
