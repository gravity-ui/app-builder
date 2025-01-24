import * as path from 'node:path';

import paths from '../../paths';
import type {LoaderDefinition} from '@rspack/core';
import {Compiler, EntryPlugin, node, rspack, web, webworker} from '@rspack/core';

type PitchLoaderDefinitionFunction = Exclude<LoaderDefinition['pitch'], undefined>;

const pluginId = 'APP_BUILDER_WORKER_LOADER';

const publicPath = path.resolve(__dirname, 'public-path.worker.js');

interface Cache {
    content?: string | Buffer;
    map?: string;
}

export const pitch: PitchLoaderDefinitionFunction = function (request) {
    this.cacheable(false);

    if (!this._compiler || !this._compilation) {
        throw new Error('Something went wrong');
    }

    const compilerOptions = this._compiler.options;

    const logger = this.getLogger(pluginId);
    if (compilerOptions.output.globalObject === 'window') {
        logger.warn(
            'Warning (app-builder-worker-loader): output.globalObject is set to "window". It should be set to "self" or "this" to support HMR in Workers.',
        );
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
        devtoolNamespace: path.resolve('/', path.relative(paths.app, this.resource)),
    };

    const workerCompiler = this._compilation.createChildCompiler(
        `worker ${request}`,
        workerOptions,
        [],
    );

    new webworker.WebWorkerTemplatePlugin().apply(workerCompiler);

    if (this.target !== 'webworker' && this.target !== 'web') {
        new node.NodeTargetPlugin().apply(workerCompiler);
    }

    /* TODO Unsupported
    new web.FetchCompileWasmPlugin({
        mangleImports: this._compiler.options.optimization.mangleWasmImports,
    }).apply(workerCompiler);
    */

    new web.FetchCompileAsyncWasmPlugin().apply(workerCompiler);

    const bundleName = path.parse(this.resourcePath).name;

    new EntryPlugin(this.context!, `!!${publicPath}`, bundleName).apply(workerCompiler);
    new EntryPlugin(this.context!, `!!${request}`, bundleName).apply(workerCompiler);

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

        return cache.get<Cache>(cacheIdent, cacheETag, (getCacheError, cacheContent) => {
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
                    sourceMap.sources = sourceMap.sources.map((pathname: string) =>
                        pathname.replace(/webpack:\/\/[^/]+\//, 'webpack://'),
                    );
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

                    parentCompilation.emitAsset(
                        assetName,
                        asset,
                        compilation.getAsset(assetName)?.info,
                    );
                }
            }
            return cache.store<Cache>(
                cacheIdent,
                cacheETag,
                {content, map: map?.toString()},
                (storeCacheError) => {
                    if (storeCacheError) {
                        return cb(storeCacheError);
                    }

                    return cb(null, content, map?.toString());
                },
            );
        });
    });
};

function configureSourceMap(compiler: Compiler) {
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
            new rspack.SourceMapDevToolPlugin({
                filename: inline ? null : compiler.options.output.sourceMapFilename,
                moduleFilenameTemplate: compiler.options.output.devtoolModuleFilenameTemplate,
                fallbackModuleFilenameTemplate:
                    compiler.options.output.devtoolFallbackModuleFilenameTemplate,
                append: hidden ? false : undefined,
                module: moduleMaps ? true : !cheap,
                columns: !cheap,
                noSources: false,
                namespace:
                    (compiler.parentCompilation?.outputOptions.devtoolNamespace ?? '') +
                    compiler.options.output.devtoolNamespace,
            }).apply(compiler);
        }
    }
}
