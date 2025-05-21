import * as path from 'node:path';
import * as fs from 'node:fs';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import {getCompilerHooks} from 'webpack-manifest-plugin';
import WebpackAssetsManifest from 'webpack-assets-manifest';
import {deferredPromise} from '../../common/utils';
import {getCompilerHooks as getRspackCompilerHooks} from 'rspack-manifest-plugin';
import {
    Compiler as RspackCompiler,
    Configuration as RspackConfiguration,
    DevServer as RspackDevServerConfiguration,
    MultiCompiler as RspackMultiCompiler,
    rspack,
} from '@rspack/core';
import {RspackDevServer} from '@rspack/dev-server';

import paths from '../../common/paths';
import {Logger} from '../../common/logger';
import {WebpackMode, rspackConfigFactory, webpackConfigFactory} from '../../common/webpack/config';

import type {Configuration, HttpProxyMiddlewareOptionsFilter} from 'webpack-dev-server';
import type {NormalizedServiceConfig} from '../../common/models';

export async function watchClientCompilation(
    config: NormalizedServiceConfig,
    onManifestReady: () => void,
) {
    const clientCompilation = await buildDevServer(config);

    const compiler = clientCompilation.compiler;
    subscribeToManifestReadyEvent(compiler, onManifestReady);

    return clientCompilation;
}

async function buildDevServer(config: NormalizedServiceConfig) {
    const bundler = config.client.bundler;
    const logger = new Logger('client', config.verbose);

    const {publicPath} = config.client;
    const {
        webSocketPath = path.normalize(`/${publicPath}/sockjs-node`),
        writeToDisk,
        ...devServer
    } = config.client.devServer || {};

    const normalizedConfig = {...config.client, devServer: {...devServer, webSocketPath}};
    const isSsr = Boolean(normalizedConfig.ssr);

    let webpackConfigs: webpack.Configuration[] = [];
    let rspackConfigs: RspackConfiguration[] = [];

    if (bundler === 'webpack') {
        webpackConfigs = [
            await webpackConfigFactory({
                webpackMode: WebpackMode.Dev,
                config: normalizedConfig,
                configPath: config.configPath,
                logger,
            }),
        ];

        if (isSsr) {
            const ssrLogger = new Logger('client(SSR)', config.verbose);
            webpackConfigs.push(
                await webpackConfigFactory({
                    webpackMode: WebpackMode.Dev,
                    config: normalizedConfig,
                    configPath: config.configPath,
                    logger: ssrLogger,
                    isSsr,
                }),
            );
        }
    } else {
        rspackConfigs = [
            await rspackConfigFactory({
                webpackMode: WebpackMode.Dev,
                config: normalizedConfig,
                configPath: config.configPath,
                logger,
            }),
        ];

        if (isSsr) {
            const ssrLogger = new Logger('client(SSR)', config.verbose);
            rspackConfigs.push(
                await rspackConfigFactory({
                    webpackMode: WebpackMode.Dev,
                    config: normalizedConfig,
                    configPath: config.configPath,
                    logger: ssrLogger,
                    isSsr,
                }),
            );
        }
    }

    // Rspack multicompiler dont work with lazy compilation.
    // Pass a single config to avoid multicompiler when SSR disabled.
    const compiler =
        bundler === 'rspack'
            ? rspack(isSsr ? rspackConfigs : rspackConfigs[0]!)
            : webpack(webpackConfigs);

    const staticFolder = path.resolve(paths.appDist, 'public');
    const options: Configuration = {
        static: staticFolder,
        setupMiddlewares(middlewares) {
            if (config.client.lazyCompilation && bundler === 'rspack') {
                const lazyCompilationMiddleware = rspack.experiments.lazyCompilationMiddleware(
                    compiler as RspackCompiler,
                    rspackConfigs[0]?.experiments?.lazyCompilation,
                );

                return [lazyCompilationMiddleware, ...middlewares];
            }

            return middlewares;
        },
        devMiddleware: {
            publicPath,
            stats: 'errors-warnings',
            writeToDisk: (target) => {
                if (writeToDisk === true) {
                    return true;
                }
                if (isSsr && target.startsWith(paths.appSsrBuild)) {
                    return true;
                }
                if (typeof writeToDisk === 'function') {
                    return writeToDisk(target);
                }
                return false;
            },
        },
        liveReload: false,
        hot: true,
        client: {
            logging: config.verbose ? 'log' : 'error',
            webSocketURL: {pathname: webSocketPath},
            overlay: {
                runtimeErrors: config.verbose,
                warnings: config.verbose,
            },
        },
        webSocketServer: {
            options: {
                path: webSocketPath,
            },
        },
        host: '0.0.0.0',
        allowedHosts: 'all',
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
        },
        ...devServer,
    };

    const listenOn = options.port || options.ipc;
    if (!listenOn) {
        options.ipc = path.resolve(paths.appDist, 'run/client.sock');
    }

    const proxy = options.proxy || [];
    if (config.client.lazyCompilation && bundler !== 'rspack') {
        proxy.push({
            context: ['/build/lazy'],
            target: `http://localhost:${config.client.lazyCompilation.port}`,
            pathRewrite: {'^/build/lazy': ''},
        });
    }

    if (config.server.port) {
        // if server port is specified, proxy to it
        const filter: HttpProxyMiddlewareOptionsFilter = (pathname, req) => {
            // do not proxy build files
            if (pathname.startsWith(publicPath)) {
                return false;
            }

            // do not proxy static files
            const filepath = path.resolve(staticFolder, pathname.replace(/^\//, ''));
            if (req.method === 'GET' && fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
                return false;
            }

            return true;
        };
        proxy.push({
            context: (...args) => filter(...args),
            target: `http://localhost:${config.server.port}`,
        });
    }

    options.proxy = proxy;

    let server: WebpackDevServer | RspackDevServer;

    if (bundler === 'rspack') {
        // Rspack multicompiler dont work with lazy compilation.
        // Pass a single config to avoid multicompiler when SSR disabled.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const compiler = rspack(isSsr ? rspackConfigs : rspackConfigs[0]!);
        server = new RspackDevServer(options as RspackDevServerConfiguration, compiler);
    } else {
        server = new WebpackDevServer(
            options,
            compiler as webpack.Compiler | webpack.MultiCompiler,
        );
    }

    try {
        await server.start();
    } catch (e) {
        logger.logError(`Cannot start ${bundler} dev server`, e);
    }

    if (options.ipc && typeof options.ipc === 'string') {
        fs.chmod(options.ipc, 0o666, (e) => logger.logError('', e));
    }

    return server;
}

function isRspackCompiler(compiler: webpack.Compiler | RspackCompiler): compiler is RspackCompiler {
    return 'rspack' in compiler;
}

function subscribeToManifestReadyEvent(
    compiler: webpack.Compiler | webpack.MultiCompiler | RspackCompiler | RspackMultiCompiler,
    onManifestReady: () => void,
) {
    const promises: Promise<unknown>[] = [];

    const options = Array.isArray(compiler.options) ? compiler.options : [compiler.options];
    const compilers = 'compilers' in compiler ? compiler.compilers : [compiler];

    for (let i = 0; i < options.length; i++) {
        const config = options[i];
        const currentCompiler = compilers[i];

        if (!config || !currentCompiler) {
            throw new Error('Something goes wrong!');
        }

        if (!isRspackCompiler(currentCompiler)) {
            const assetsManifestPlugin = config.plugins.find(
                (plugin) => plugin instanceof WebpackAssetsManifest,
            );

            if (assetsManifestPlugin) {
                const assetsManifestReady = deferredPromise();
                promises.push(assetsManifestReady.promise);
                assetsManifestPlugin.hooks.done.tap('app-builder', assetsManifestReady.resolve);
            }
        }

        const manifestReady = deferredPromise();
        promises.push(manifestReady.promise);

        if (isRspackCompiler(currentCompiler)) {
            const {afterEmit} = getRspackCompilerHooks(currentCompiler);
            afterEmit.tap('app-builder', manifestReady.resolve);
        } else {
            const {afterEmit} = getCompilerHooks(currentCompiler);
            afterEmit.tap('app-builder', manifestReady.resolve);
        }
    }

    Promise.all(promises).then(() => onManifestReady());
}
