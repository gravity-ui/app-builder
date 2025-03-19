"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTsProjectConfigPath = getTsProjectConfigPath;
exports.getTsProjectConfig = getTsProjectConfig;
exports.displayFilename = displayFilename;
exports.onHostEvent = onHostEvent;
exports.resolveTypescript = resolveTypescript;
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = __importDefault(require("../paths"));
function getTsProjectConfigPath(ts, projectPath, filename = 'tsconfig.json') {
    const configPath = ts.findConfigFile(projectPath, ts.sys.fileExists, filename);
    if (!configPath) {
        throw new Error(`Could not find a valid '${filename}'.`);
    }
    return configPath;
}
function getTsProjectConfig(ts, projectPath, filename = 'tsconfig.json', optionsToExtend) {
    const configPath = getTsProjectConfigPath(ts, projectPath, filename);
    const parseConfigFileHost = {
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        readDirectory: ts.sys.readDirectory,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        // this is required in types but not used
        onUnRecoverableConfigFileDiagnostic: () => { },
    };
    const parsedConfig = ts.getParsedCommandLineOfConfigFile(configPath, optionsToExtend, parseConfigFileHost);
    if (!parsedConfig) {
        throw new Error(`Invalid config file '${configPath}'`);
    }
    return parsedConfig;
}
function displayFilename(originalFunc, operationName, logger) {
    let displayEnabled = false;
    let count = 0;
    function displayFunction(...args) {
        count++;
        if (displayEnabled) {
            const fileName = args[0];
            logger.status(logger.colors.dim(`${operationName}: ${fileName}`));
        }
        return originalFunc(...args);
    }
    displayFunction.originalFunc = originalFunc;
    displayFunction.enableDisplay = () => {
        count = 0;
        if (process.stdout.isTTY && logger.isVerbose) {
            displayEnabled = true;
        }
    };
    displayFunction.disableDisplay = () => {
        if (displayEnabled) {
            displayEnabled = false;
            logger.clearLine();
        }
        return count;
    };
    return displayFunction;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onHostEvent(host, functionName, before, after) {
    const originalFunction = host[functionName];
    // eslint-disable-next-line no-param-reassign
    host[functionName] = ((...args) => {
        if (before) {
            before(...args);
        }
        let result;
        if (typeof originalFunction === 'function') {
            result = originalFunction(...args);
        }
        if (after) {
            after(result);
        }
        return result;
    });
}
function resolveTypescript() {
    try {
        return require.resolve(node_path_1.default.resolve(paths_1.default.appNodeModules, 'typescript'));
    }
    catch (err) {
        if (!err ||
            typeof err !== 'object' ||
            !('code' in err) ||
            err.code !== 'MODULE_NOT_FOUND') {
            throw err;
        }
        return require.resolve('typescript');
    }
}
