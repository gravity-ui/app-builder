import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import webpack from 'webpack';
import type * as Rspack from '@rspack/core';

import {WorkerPublicPathPlugin} from '../worker-public-path-plugin.js';

// Jest does not provide `import.meta.dirname`, which @rspack/core 2 needs, so Rspack is loaded
// by the Node.js loader instead of the Jest one (`createRequire` imported from `node:module`
// is patched by Jest).
const nodeRequire = process.getBuiltinModule('node:module').createRequire(import.meta.url);
const {rspack}: typeof Rspack = nodeRequire('@rspack/core');

const appDirectory = fileURLToPath(new URL('../__fixtures__/cdn-compat-app', import.meta.url));
const outputPaths: string[] = [];

export interface BuildOptions {
    bundler: 'webpack' | 'rspack';
    moduleFederation: boolean;
    workerPublicPathPlugin: boolean;
}

export interface BuiltApp {
    outputPath: string;
    workerScript: string;
}

// Builds the fixture app in development mode with the parts of the app-builder config that
// matter for `webWorkerHandle: 'cdn-compat'` workers. The worker loader is left out on purpose:
// it only replaces the worker entry module, while the plugin patches the worker chunk runtime.
export async function buildApp(options: BuildOptions): Promise<BuiltApp> {
    const outputPath = await fs.mkdtemp(path.join(os.tmpdir(), 'app-builder-worker-'));
    outputPaths.push(outputPath);

    await compile(options.bundler, await createConfig(options, outputPath));

    return {outputPath, workerScript: 'js/worker.chunk.js'};
}

export async function removeBuiltApps() {
    const paths = outputPaths.splice(0);
    await Promise.all(paths.map((outputPath) => fs.rm(outputPath, {recursive: true, force: true})));
}

async function createConfig(
    {bundler, moduleFederation, workerPublicPathPlugin}: BuildOptions,
    outputPath: string,
): Promise<webpack.Configuration> {
    const plugins: webpack.WebpackPluginInstance[] = [];
    if (workerPublicPathPlugin) {
        plugins.push(new WorkerPublicPathPlugin());
    }
    if (moduleFederation) {
        // Plugins must come from the same realm as the bundler that validates them.
        const {ModuleFederationPlugin} =
            bundler === 'rspack'
                ? nodeRequire('@module-federation/enhanced/rspack')
                : await import('@module-federation/enhanced/webpack');
        plugins.push(new ModuleFederationPlugin({name: 'app', filename: 'entry.js'}));
    }

    return {
        mode: 'development',
        context: appDirectory,
        entry: {main: './index.js'},
        devtool: false,
        output: {
            path: outputPath,
            filename: 'js/[name].js',
            chunkFilename: 'js/[name].chunk.js',
            ...(moduleFederation ? {publicPath: 'auto', uniqueName: 'app'} : undefined),
        },
        optimization: {
            runtimeChunk: moduleFederation ? false : 'single',
            splitChunks: {
                cacheGroups: {
                    shared: {name: 'shared', chunks: 'async', minChunks: 2, minSize: 0},
                },
            },
        },
        infrastructureLogging: {level: 'error'},
        plugins,
    };
}

function compile(bundler: BuildOptions['bundler'], config: webpack.Configuration) {
    return new Promise<void>((resolve, reject) => {
        const callback = (error?: Error | null, stats?: webpack.Stats | Rspack.Stats) => {
            if (error || !stats) {
                return reject(error ?? new Error('Compilation finished without stats'));
            }
            if (stats.hasErrors()) {
                return reject(new Error(stats.toString({all: false, errors: true})));
            }
            return resolve();
        };

        if (bundler === 'rspack') {
            rspack(config as Rspack.Configuration, callback);
        } else {
            webpack(config, callback);
        }
    });
}
