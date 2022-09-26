import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import {getCompilerHooks} from 'webpack-manifest-plugin';

import paths from '../../common/paths';
import {Logger} from '../../common/logger';
import {webpackConfigFactory, WebpackMode} from '../../common/webpack/config';

import type {Configuration} from 'webpack-dev-server';
import type {NormalizedServiceConfig} from '../../common/models';

export async function watchClientCompilation(
    config: NormalizedServiceConfig,
    onCompilationEnd: () => void,
) {
    const clientCompilation = await buildWebpackServer(config);
    const {afterEmit} = getCompilerHooks(clientCompilation.compiler as webpack.Compiler);
    afterEmit.tap('app-builder: afterEmit', onCompilationEnd);
    return clientCompilation;
}

async function buildWebpackServer(config: NormalizedServiceConfig) {
    const logger = new Logger('webpack', config.verbose);

    const {
        webSocketPath = path.normalize(`/${config.client.publicPathPrefix}/build/sockjs-node`),
        ...devServer
    } = config.client.devServer || {};

    const normalizedConfig = {...config.client, devServer: {...devServer, webSocketPath}};
    const webpackConfig = webpackConfigFactory(WebpackMode.Dev, normalizedConfig, {logger});

    const options: Configuration = {
        static: path.resolve(paths.appDist, 'public'),
        devMiddleware: {
            publicPath: path.normalize(config.client.publicPathPrefix + '/build/'),
            stats: 'errors-warnings',
        },
        liveReload: false,
        hot: true,
        client: {
            webSocketURL: {pathname: webSocketPath},
            overlay: {
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

    let listenOn = options.port || options.ipc;

    if (!listenOn) {
        listenOn = path.resolve(paths.appDist, 'run/client.sock');
        options.ipc = listenOn;
    }

    if (config.client.lazyCompilation) {
        options.proxy = {
            ...options.proxy,
            '/build/lazy': {
                target: `http://localhost:${config.client.lazyCompilation.port}`,
                pathRewrite: {'^/build/lazy': ''},
            },
        };
    }

    if (config.server.port) {
        options.proxy = {
            ...options.proxy,
            '/': {
                target: `http://localhost:${config.server.port}`,
                bypass: (req) => {
                    if (req.method !== 'GET' && req.method !== 'HEAD') {
                        return null;
                    }

                    const pathname = req.path.replace(/^\//, '');
                    const filepath = path.resolve(paths.appDist, 'public', pathname);
                    if (!fs.existsSync(filepath)) {
                        return null;
                    }

                    const stat = fs.statSync(filepath);
                    if (!stat.isFile()) {
                        return null;
                    }

                    return req.path;
                },
            },
        };
    }

    const compiler = webpack(webpackConfig);
    const server = new WebpackDevServer(options, compiler);

    try {
        await server.start();
    } catch (e) {
        logger.logError(e as any);
    }

    if (options.ipc && typeof options.ipc === 'string') {
        fs.chmod(options.ipc, 0o666, (e) => logger.logError('', e));
    }

    return server;
}
