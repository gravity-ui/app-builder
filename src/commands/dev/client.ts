import * as path from 'node:path';
import * as fs from 'node:fs';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import {getCompilerHooks} from 'webpack-manifest-plugin';
import WebpackAssetsManifest from 'webpack-assets-manifest';
import {deferredPromise} from '../../common/utils';

import paths from '../../common/paths';
import {Logger} from '../../common/logger';
import {WebpackMode, webpackConfigFactory} from '../../common/webpack/config';

import type {Configuration, HttpProxyMiddlewareOptionsFilter} from 'webpack-dev-server';
import type {NormalizedServiceConfig} from '../../common/models';

export async function watchClientCompilation(
    config: NormalizedServiceConfig,
    onManifestReady: () => void,
) {
    const clientCompilation = await buildWebpackServer(config);

    const compiler = clientCompilation.compiler;
    if ('compilers' in compiler) {
        throw new Error('Unexpected multi compiler');
    }
    subscribeToManifestReadyEvent(compiler, onManifestReady);

    return clientCompilation;
}

async function buildWebpackServer(config: NormalizedServiceConfig) {
    const logger = new Logger('webpack', config.verbose);

    const {
        webSocketPath = path.normalize(`/${config.client.publicPathPrefix}/build/sockjs-node`),
        writeToDisk,
        ...devServer
    } = config.client.devServer || {};

    const normalizedConfig = {...config.client, devServer: {...devServer, webSocketPath}};
    const webpackConfig = await webpackConfigFactory(WebpackMode.Dev, normalizedConfig, {logger});

    const publicPath = path.normalize(config.client.publicPathPrefix + '/build/');
    const staticFolder = path.resolve(paths.appDist, 'public');
    const options: Configuration = {
        static: staticFolder,
        devMiddleware: {
            publicPath,
            stats: 'errors-warnings',
            writeToDisk,
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
    if (config.client.lazyCompilation) {
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

    const compiler = webpack(webpackConfig);
    const server = new WebpackDevServer(options, compiler);

    try {
        await server.start();
    } catch (e) {
        logger.logError('Cannot start webpack dev server', e);
    }

    if (options.ipc && typeof options.ipc === 'string') {
        fs.chmod(options.ipc, 0o666, (e) => logger.logError('', e));
    }

    return server;
}

function subscribeToManifestReadyEvent(compiler: webpack.Compiler, onManifestReady: () => void) {
    const promises: Promise<unknown>[] = [];

    const assetsManifestPlugin = compiler.options.plugins.find(
        (plugin) => plugin instanceof WebpackAssetsManifest,
    );

    if (assetsManifestPlugin) {
        const assetsManifestReady = deferredPromise();
        promises.push(assetsManifestReady.promise);
        assetsManifestPlugin.hooks.done.tap('app-builder', assetsManifestReady.resolve);
    }

    const manifestReady = deferredPromise();
    promises.push(manifestReady.promise);
    const {afterEmit} = getCompilerHooks(compiler);
    afterEmit.tap('app-builder', manifestReady.resolve);

    Promise.all(promises).then(() => onManifestReady());
}
