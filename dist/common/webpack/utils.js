"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compilerHandlerFactory = compilerHandlerFactory;
exports.resolveTsConfigPathsToAlias = resolveTsConfigPathsToAlias;
const path = __importStar(require("node:path"));
const ts = __importStar(require("typescript"));
const pretty_time_1 = require("../logger/pretty-time");
const utils_1 = require("../typescript/utils");
function compilerHandlerFactory(logger, onCompilationEnd) {
    return async (err, stats) => {
        if (err) {
            logger.panic(err.message, err);
        }
        if (stats) {
            logger.message('Stats:\n' +
                stats.toString({
                    preset: 'errors-warnings',
                    colors: process.stdout.isTTY,
                    assets: logger.isVerbose,
                    modules: logger.isVerbose,
                    entrypoints: logger.isVerbose,
                    timings: logger.isVerbose,
                }));
            if (stats.hasErrors()) {
                process.exit(1);
            }
        }
        if (onCompilationEnd) {
            await onCompilationEnd();
        }
        const [clientStats, ssrStats] = stats?.stats ?? [];
        if (clientStats) {
            const { startTime = 0, endTime = 0 } = clientStats;
            const time = endTime - startTime;
            logger.success(`Client was successfully compiled in ${(0, pretty_time_1.prettyTime)(BigInt(time) * BigInt(1_000_000))}`);
        }
        if (ssrStats) {
            const { startTime = 0, endTime = 0 } = ssrStats;
            const time = endTime - startTime;
            logger.success(`SSR: Client was successfully compiled in ${(0, pretty_time_1.prettyTime)(BigInt(time) * BigInt(1_000_000))}`);
        }
        if (!clientStats && !ssrStats) {
            logger.success(`Client was successfully compiled`);
        }
    };
}
const endStarRe = /\/?\*$/;
function resolveTsConfigPathsToAlias(projectPath, filename = 'tsconfig.json') {
    let parsed;
    try {
        parsed = (0, utils_1.getTsProjectConfig)(ts, projectPath, filename);
    }
    catch {
        return {};
    }
    if (parsed.errors.length > 0) {
        return {};
    }
    const { paths = {}, baseUrl } = parsed.options;
    if (!baseUrl) {
        return {};
    }
    const basePath = path.resolve(path.dirname(projectPath), baseUrl);
    const aliases = {};
    const modules = [basePath];
    for (const [key, value] of Object.entries(paths)) {
        if (!Array.isArray(value) || value.length === 0) {
            continue;
        }
        const name = key.replace(endStarRe, '');
        if (name === '' || name === '.') {
            modules.push(...value.map((v) => path.resolve(basePath, `${v}`.replace(endStarRe, ''))));
            continue;
        }
        aliases[name] = value.map((v) => path.resolve(basePath, `${v}`.replace(endStarRe, '')));
    }
    return { aliases, modules };
}
