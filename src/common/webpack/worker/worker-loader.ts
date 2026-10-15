import {createHash} from 'node:crypto';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

import type * as Webpack from 'webpack';

import paths from '../../paths.js';

const pluginId = 'APP_BUILDER_WORKER_LOADER';

const publicPath = fileURLToPath(new URL('./public-path.worker.js', import.meta.url));

export const pitch: Webpack.PitchLoaderDefinitionFunction = function (request) {
    if (!this._compiler || !this._compilation) {
        throw new Error('Something went wrong');
    }

    const {options: compilerOptions, webpack} = this._compiler;

    const logger = this.getLogger(pluginId);
    if (compilerOptions.output.globalObject === 'window') {
        logger.warn(
            'Warning (app-builder-worker-loader): output.globalObject is set to "window". It should be set to "self" or "this" to support HMR in Workers.',
        );
    }

    const isEnvProduction = compilerOptions.mode === 'production';
    const filename = 'worker.js';
    const workerPath = path.relative(paths.app, this.resource);
    const workerId = createHash('sha256').update(workerPath).digest('hex').slice(0, 8);
    const chunkFilename = isEnvProduction
        ? `js/[name].[contenthash:8].${workerId}.worker.js`
        : `js/[name].${workerId}.worker.js`;

    const workerOptions = {
        filename,
        chunkFilename,
        publicPath: compilerOptions.output.publicPath,
        globalObject: 'self',
        devtoolNamespace: path.resolve('/', workerPath),
    };

    const workerCompiler = this._compilation.createChildCompiler(
        `worker ${request}`,
        workerOptions,
    );

    const {
        EntryPlugin,
        node: {NodeTargetPlugin},
        web: {FetchCompileWasmPlugin, FetchCompileAsyncWasmPlugin},
        webworker: {WebWorkerTemplatePlugin},
    } = webpack;

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
            for (const dependency of compilation.fileDependencies) {
                this.addDependency(dependency);
            }
            for (const dependency of compilation.contextDependencies) {
                this.addContextDependency(dependency);
            }
            for (const dependency of compilation.missingDependencies) {
                this.addMissingDependency(dependency);
            }
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

        let content = compilation.assets[filename]?.source().toString();
        if (content === undefined) {
            return cb(new Error(`Asset ${filename} not found in compilation`));
        }

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
        if (license && content.startsWith('/*')) {
            content = content.replace(/^\/\*.*?\*\//, () => license);
        }

        // Unlike parentCompilation.emitAsset, emitFile stores the asset with the module, so it survives a restore from cache.
        for (const [assetName, asset] of Object.entries(compilation.assets)) {
            if ([filename, mapFile, licenseFile].includes(assetName)) {
                continue;
            }

            this.emitFile(
                assetName,
                asset.source(),
                undefined,
                compilation.getAsset(assetName)?.info,
            );
        }

        return cb(null, content, map?.toString());
    });
};

function configureSourceMap(compiler: Webpack.Compiler) {
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
