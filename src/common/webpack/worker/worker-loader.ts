import path from 'node:path';

import webpack from 'webpack';
import NodeTargetPlugin from 'webpack/lib/node/NodeTargetPlugin';
import WebWorkerTemplatePlugin from 'webpack/lib/webworker/WebWorkerTemplatePlugin';
import FetchCompileWasmPlugin from 'webpack/lib/web/FetchCompileWasmPlugin';
import FetchCompileAsyncWasmPlugin from 'webpack/lib/web/FetchCompileAsyncWasmPlugin';

import paths from '../../paths';

const publicPath = path.resolve(__dirname, 'public-path.worker.js');

export const pitch: webpack.PitchLoaderDefinitionFunction = function (request) {
    this.cacheable(false);

    if (!this._compiler || !this._compilation) {
        throw new Error('Something went wrong');
    }

    const compilerOptions = this._compiler.options;

    const logger = this.getLogger('APP_BUILDER_WORKER_LOADER');
    if (compilerOptions.output.globalObject === 'window') {
        logger.warn(
            'Warning (app-builder-worker-loader): output.globalObject is set to "window". It should be set to "self" or "this" to support HMR in Workers.',
        );
    }

    const isEnvProduction = compilerOptions.mode === 'production';
    const filename = isEnvProduction
        ? 'js/[name].[contenthash:8].worker.js'
        : 'js/[name].worker.js';

    const workerOptions = {
        filename,
        chunkFilename: filename,
        publicPath: compilerOptions.output.publicPath,
        globalObject: 'self',
        devtoolNamespace: path.resolve('/', path.relative(paths.app, this.resource)),
    };

    const workerCompiler = this._compilation.createChildCompiler(
        `worker ${request}`,
        workerOptions,
    );

    new WebWorkerTemplatePlugin().apply(workerCompiler);

    if (this.target !== 'webworker' && this.target !== 'web') {
        new NodeTargetPlugin().apply(workerCompiler);
    }
    new FetchCompileWasmPlugin({
        mangleImports: this._compiler.options.optimization.mangleWasmImports,
    }).apply(workerCompiler);

    new FetchCompileAsyncWasmPlugin().apply(workerCompiler);

    const bundleName = path.parse(this.resourcePath).name;

    new webpack.EntryPlugin(this.context, `!!${publicPath}`, bundleName).apply(workerCompiler);
    new webpack.EntryPlugin(this.context, `!!${request}`, bundleName).apply(workerCompiler);

    configureSourceMap(workerCompiler);

    const cb = this.async();
    workerCompiler.compile((err, compilation) => {
        if (!compilation) {
            return undefined;
        }

        workerCompiler.parentCompilation?.children.push(compilation);

        if (err) {
            return cb(err);
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

        const file = Object.keys(compilation.assets)[0];
        if (file) {
            const contents = compilation.assets[file]?.source();
            const mapFile = `${file}.map`;
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
            for (const [fileName, asset] of Object.entries(compilation.assets)) {
                if ([file, mapFile].includes(fileName)) {
                    continue;
                }
                workerCompiler.parentCompilation?.emitAsset(
                    fileName,
                    asset,
                    compilation.assetsInfo.get(fileName),
                );
            }
            return cb(null, contents, map?.toString());
        }
        return cb(null, undefined);
    });
};

function configureSourceMap(compiler: webpack.Compiler) {
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
            new webpack.SourceMapDevToolPlugin({
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
