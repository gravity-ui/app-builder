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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pitch = void 0;
const path = __importStar(require("node:path"));
const paths_1 = __importDefault(require("../../paths"));
const pluginId = 'APP_BUILDER_WORKER_LOADER';
const publicPath = path.resolve(__dirname, 'public-path.worker.js');
const pitch = function (request) {
    this.cacheable(false);
    if (!this._compiler || !this._compilation) {
        throw new Error('Something went wrong');
    }
    const { options: compilerOptions, webpack } = this._compiler;
    const logger = this.getLogger(pluginId);
    if (compilerOptions.output.globalObject === 'window') {
        logger.warn('Warning (app-builder-worker-loader): output.globalObject is set to "window". It should be set to "self" or "this" to support HMR in Workers.');
    }
    const isEnvProduction = compilerOptions.mode === 'production';
    const filename = 'worker.js';
    const chunkFilename = isEnvProduction
        ? 'js/[name].[contenthash:8].worker.js'
        : 'js/[name].worker.js';
    const workerOptions = {
        filename,
        chunkFilename,
        publicPath: compilerOptions.output.publicPath,
        globalObject: 'self',
        devtoolNamespace: path.resolve('/', path.relative(paths_1.default.app, this.resource)),
    };
    const workerCompiler = this._compilation.createChildCompiler(`worker ${request}`, workerOptions);
    const { EntryPlugin, node: { NodeTargetPlugin }, web: { FetchCompileWasmPlugin, FetchCompileAsyncWasmPlugin }, webworker: { WebWorkerTemplatePlugin }, } = webpack;
    new WebWorkerTemplatePlugin().apply(workerCompiler);
    if (this.target !== 'webworker' && this.target !== 'web') {
        new NodeTargetPlugin().apply(workerCompiler);
    }
    if (FetchCompileWasmPlugin) {
        new FetchCompileWasmPlugin({
            mangleImports: this._compiler.options.optimization.mangleWasmImports,
        }).apply(workerCompiler);
    }
    if (FetchCompileAsyncWasmPlugin) {
        new FetchCompileAsyncWasmPlugin().apply(workerCompiler);
    }
    const bundleName = path.parse(this.resourcePath).name;
    new EntryPlugin(this.context, `!!${publicPath}`, bundleName).apply(workerCompiler);
    new EntryPlugin(this.context, `!!${request}`, bundleName).apply(workerCompiler);
    configureSourceMap(workerCompiler);
    const cb = this.async();
    workerCompiler.compile((err, compilation) => {
        if (compilation) {
            workerCompiler.parentCompilation?.children.push(compilation);
        }
        if (err) {
            return cb(err);
        }
        if (!compilation) {
            return cb(new Error('Child compilation failed'));
        }
        if (compilation.errors && compilation.errors.length) {
            const errorDetails = compilation.errors
                .map((error) => {
                if (error instanceof Error) {
                    return error.stack;
                }
                return error;
            })
                .join('\n');
            return cb(new Error('Child compilation failed:\n' + errorDetails));
        }
        const cache = workerCompiler.getCache(pluginId);
        const cacheIdent = request;
        const objectToHash = compilation.assets[filename];
        if (!objectToHash) {
            return cb(new Error(`Asset ${filename} not found in compilation`));
        }
        const cacheETag = cache.getLazyHashedEtag(objectToHash);
        return cache.get(cacheIdent, cacheETag, (getCacheError, cacheContent) => {
            if (getCacheError) {
                return cb(getCacheError);
            }
            if (cacheContent) {
                return cb(null, cacheContent.content, cacheContent.map);
            }
            let content = compilation.assets[filename]?.source().toString();
            const mapFile = `${filename}.map`;
            let map = compilation.assets[mapFile]?.source();
            if (map) {
                const sourceMap = JSON.parse(map.toString());
                if (Array.isArray(sourceMap.sources)) {
                    sourceMap.sources = sourceMap.sources.map((pathname) => pathname.replace(/webpack:\/\/[^/]+\//, 'webpack://'));
                }
                map = JSON.stringify(sourceMap);
            }
            const licenseFile = `${filename}.LICENSE.txt`;
            const license = compilation.assets[licenseFile]?.source().toString();
            if (license && content) {
                if (content.startsWith('/*')) {
                    content = content.replace(/^\/\*.*?\*\//, license);
                }
            }
            const parentCompilation = workerCompiler.parentCompilation;
            if (parentCompilation) {
                for (const [assetName, asset] of Object.entries(compilation.assets)) {
                    if ([filename, mapFile, licenseFile].includes(assetName)) {
                        continue;
                    }
                    if (parentCompilation.getAsset(assetName)) {
                        continue;
                    }
                    parentCompilation.emitAsset(assetName, asset, compilation.getAsset(assetName)?.info);
                }
            }
            return cache.store(cacheIdent, cacheETag, { content, map: map?.toString() }, (storeCacheError) => {
                if (storeCacheError) {
                    return cb(storeCacheError);
                }
                return cb(null, content, map?.toString());
            });
        });
    });
};
exports.pitch = pitch;
function configureSourceMap(compiler) {
    const devtool = compiler.options.devtool;
    if (devtool) {
        if (devtool.includes('source-map')) {
            // remove parent SourceMapDevToolPlugin from compilation
            for (const hook of Object.values(compiler.hooks)) {
                for (let i = hook.taps.length - 1; i >= 0; i--) {
                    const tap = hook.taps[i];
                    if (tap?.name === 'SourceMapDevToolPlugin') {
                        hook.taps.splice(i, 1);
                    }
                }
            }
            const hidden = devtool.includes('hidden');
            const inline = devtool.includes('inline');
            const cheap = devtool.includes('cheap');
            const moduleMaps = devtool.includes('module');
            new compiler.webpack.SourceMapDevToolPlugin({
                filename: inline ? null : compiler.options.output.sourceMapFilename,
                moduleFilenameTemplate: compiler.options.output.devtoolModuleFilenameTemplate,
                fallbackModuleFilenameTemplate: compiler.options.output.devtoolFallbackModuleFilenameTemplate,
                append: hidden ? false : undefined,
                module: moduleMaps ? true : !cheap,
                columns: !cheap,
                noSources: false,
                namespace: (compiler.parentCompilation?.outputOptions.devtoolNamespace ?? '') +
                    compiler.options.output.devtoolNamespace,
            }).apply(compiler);
        }
    }
}
