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
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);
exports.default = {
    app: resolveApp('.'),
    appNodeModules: resolveApp('node_modules'),
    appClient: resolveApp('src/ui'),
    appServer: resolveApp('src/server'),
    appEntry: resolveApp('src/ui/entries'),
    appDist: resolveApp('dist'),
    appRun: resolveApp('dist/run'),
    appBuild: resolveApp('dist/public/build'),
    appSsrEntry: resolveApp('src/ui/ssr'),
    appSsrBuild: resolveApp('dist/ssr'),
    src: resolveApp('src'),
    libBuild: resolveApp('build'),
    libBuildEsm: resolveApp('build/esm'),
    libBuildCjs: resolveApp('build/cjs'),
    libAssets: resolveApp('assets'),
    libGlobalStyles: resolveApp('styles'),
    libCompiledGlobalStyles: resolveApp('build/styles'),
    libCompiledAssetsEsm: resolveApp('build/esm/assets'),
    libCompiledAssetsCjs: resolveApp('build/cjs/assets'),
};
