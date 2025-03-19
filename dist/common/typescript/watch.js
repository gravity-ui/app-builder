"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watch = watch;
const transformers_1 = require("./transformers");
const utils_1 = require("./utils");
const diagnostic_1 = require("./diagnostic");
function watch(ts, projectPath, { logger, onAfterFilesEmitted, enableSourceMap, }) {
    logger.message('Start compilation in watch mode');
    logger.message(`Typescript v${ts.version}`);
    const configPath = (0, utils_1.getTsProjectConfigPath)(ts, projectPath);
    const createProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram;
    const host = ts.createWatchCompilerHost(configPath, {
        noEmit: false,
        noEmitOnError: false,
        inlineSourceMap: enableSourceMap,
        inlineSources: enableSourceMap,
        ...(enableSourceMap ? { sourceMap: false } : undefined),
    }, ts.sys, createProgram, reportDiagnostic, reportWatchStatusChanged);
    host.readFile = (0, utils_1.displayFilename)(host.readFile, 'Reading', logger);
    (0, utils_1.onHostEvent)(host, 'createProgram', () => {
        logger.verbose("We're about to create the program");
        // @ts-expect-error
        host.readFile.enableDisplay();
    }, () => {
        // @ts-expect-error
        const count = host.readFile.disableDisplay();
        logger.verbose(`Program created, read ${count} files`);
    });
    (0, utils_1.onHostEvent)(host, 'afterProgramCreate', (program) => {
        logger.verbose('We finished making the program! Emitting...');
        const transformPathsToLocalModules = (0, transformers_1.createTransformPathsToLocalModules)(ts);
        program.emit(undefined, undefined, undefined, undefined, {
            after: [transformPathsToLocalModules],
            afterDeclarations: [transformPathsToLocalModules],
        });
        logger.verbose('Emit completed!');
    }, () => {
        onAfterFilesEmitted?.();
    });
    // `createWatchProgram` creates an initial program, watches files, and updates
    // the program over time.
    ts.createWatchProgram(host);
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
    /*
     * Prints a diagnostic every time the watch status changes.
     * This is mainly for messages like "Starting compilation" or "Compilation completed".
     */
    function reportWatchStatusChanged(diagnostic) {
        if (diagnostic.messageText) {
            logger.message(ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine));
        }
    }
}
