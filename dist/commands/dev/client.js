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
exports.watchClientCompilation = watchClientCompilation;
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const webpack_1 = __importDefault(require("webpack"));
const webpack_dev_server_1 = __importDefault(require("webpack-dev-server"));
const webpack_manifest_plugin_1 = require("webpack-manifest-plugin");
const webpack_assets_manifest_1 = __importDefault(require("webpack-assets-manifest"));
const utils_1 = require("../../common/utils");
const rspack_manifest_plugin_1 = require("rspack-manifest-plugin");
const core_1 = require("@rspack/core");
const dev_server_1 = require("@rspack/dev-server");
const paths_1 = __importDefault(require("../../common/paths"));
const logger_1 = require("../../common/logger");
const config_1 = require("../../common/webpack/config");
async function watchClientCompilation(config, onManifestReady) {
    const clientCompilation = await buildDevServer(config);
    const compiler = clientCompilation.compiler;
    subscribeToManifestReadyEvent(compiler, onManifestReady);
    return clientCompilation;
}
async function buildDevServer(config) {
    const bundler = config.client.bundler;
    const logger = new logger_1.Logger('client', config.verbose);
    const { webSocketPath = path.normalize(`/${config.client.publicPathPrefix}/build/sockjs-node`), writeToDisk, ...devServer } = config.client.devServer || {};
    const normalizedConfig = { ...config.client, devServer: { ...devServer, webSocketPath } };
    const isSsr = Boolean(normalizedConfig.ssr);
    let webpackConfigs = [];
    let rspackConfigs = [];
    if (bundler === 'webpack') {
        webpackConfigs = [
            await (0, config_1.webpackConfigFactory)({
                webpackMode: "development" /* WebpackMode.Dev */,
                config: normalizedConfig,
                logger,
            }),
        ];
        if (isSsr) {
            const ssrLogger = new logger_1.Logger('client(SSR)', config.verbose);
            webpackConfigs.push(await (0, config_1.webpackConfigFactory)({
                webpackMode: "development" /* WebpackMode.Dev */,
                config: normalizedConfig,
                logger: ssrLogger,
                isSsr,
            }));
        }
    }
    else {
        rspackConfigs = [
            await (0, config_1.rspackConfigFactory)({
                webpackMode: "development" /* WebpackMode.Dev */,
                config: normalizedConfig,
                logger,
            }),
        ];
        if (isSsr) {
            const ssrLogger = new logger_1.Logger('client(SSR)', config.verbose);
            rspackConfigs.push(await (0, config_1.rspackConfigFactory)({
                webpackMode: "development" /* WebpackMode.Dev */,
                config: normalizedConfig,
                logger: ssrLogger,
                isSsr,
            }));
        }
    }
    const publicPath = path.normalize(config.client.publicPathPrefix + '/build/');
    const staticFolder = path.resolve(paths_1.default.appDist, 'public');
    const options = {
        static: staticFolder,
        devMiddleware: {
            publicPath,
            stats: 'errors-warnings',
            writeToDisk: (target) => {
                if (writeToDisk === true) {
                    return true;
                }
                if (isSsr && target.startsWith(paths_1.default.appSsrBuild)) {
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
            webSocketURL: { pathname: webSocketPath },
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
        options.ipc = path.resolve(paths_1.default.appDist, 'run/client.sock');
    }
    const proxy = options.proxy || [];
    if (config.client.lazyCompilation) {
        proxy.push({
            context: ['/build/lazy'],
            target: `http://localhost:${config.client.lazyCompilation.port}`,
            pathRewrite: { '^/build/lazy': '' },
        });
    }
    if (config.server.port) {
        // if server port is specified, proxy to it
        const filter = (pathname, req) => {
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
    let server;
    if (bundler === 'rspack') {
        // Rspack multicompiler dont work with lazy compilation.
        // Pass a single config to avoid multicompiler when SSR disabled.
        const compiler = (0, core_1.rspack)(isSsr ? rspackConfigs : rspackConfigs[0]);
        server = new dev_server_1.RspackDevServer(options, compiler);
    }
    else {
        const compiler = (0, webpack_1.default)(webpackConfigs);
        server = new webpack_dev_server_1.default(options, compiler);
    }
    try {
        await server.start();
    }
    catch (e) {
        logger.logError(`Cannot start ${bundler} dev server`, e);
    }
    if (options.ipc && typeof options.ipc === 'string') {
        fs.chmod(options.ipc, 0o666, (e) => logger.logError('', e));
    }
    return server;
}
function isRspackCompiler(compiler) {
    return 'rspack' in compiler;
}
function subscribeToManifestReadyEvent(compiler, onManifestReady) {
    const promises = [];
    const options = Array.isArray(compiler.options) ? compiler.options : [compiler.options];
    const compilers = 'compilers' in compiler ? compiler.compilers : [compiler];
    for (let i = 0; i < options.length; i++) {
        const config = options[i];
        const compiler = compilers[i];
        if (!config || !compiler) {
            throw new Error('Something goes wrong!');
        }
        if (!isRspackCompiler(compiler)) {
            const assetsManifestPlugin = config.plugins.find((plugin) => plugin instanceof webpack_assets_manifest_1.default);
            if (assetsManifestPlugin) {
                const assetsManifestReady = (0, utils_1.deferredPromise)();
                promises.push(assetsManifestReady.promise);
                assetsManifestPlugin.hooks.done.tap('app-builder', assetsManifestReady.resolve);
            }
        }
        const manifestReady = (0, utils_1.deferredPromise)();
        promises.push(manifestReady.promise);
        if (isRspackCompiler(compiler)) {
            const { afterEmit } = (0, rspack_manifest_plugin_1.getCompilerHooks)(compiler);
            afterEmit.tap('app-builder', manifestReady.resolve);
        }
        else {
            const { afterEmit } = (0, webpack_manifest_plugin_1.getCompilerHooks)(compiler);
            afterEmit.tap('app-builder', manifestReady.resolve);
        }
    }
    Promise.all(promises).then(() => onManifestReady());
}
