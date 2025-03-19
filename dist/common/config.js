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
exports.getProjectConfig = getProjectConfig;
exports.normalizeConfig = normalizeConfig;
const path = __importStar(require("node:path"));
const cosmiconfig_1 = require("cosmiconfig");
const cosmiconfig_typescript_loader_1 = require("cosmiconfig-typescript-loader");
const models_1 = require("./models");
const utils_1 = require("./utils");
function splitPaths(paths) {
    return (Array.isArray(paths) ? paths : [paths]).flatMap((p) => p.split(','));
}
function remapPaths(paths) {
    return splitPaths(paths).map((p) => path.resolve(process.cwd(), p));
}
function omitUndefined(obj) {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            newObj[key] = value;
        }
    }
    return newObj;
}
function getModuleLoader({ storybook } = {}) {
    if (!storybook) {
        return (0, cosmiconfig_typescript_loader_1.TypeScriptLoader)();
    }
    // storybook 7 uses esbuild-register to compile ts to cjs
    // https://github.com/storybookjs/storybook/blob/c1ec290b3a74ce05b23f74250539ae571bffaa66/code/lib/core-common/src/utils/interpret-require.ts#L11
    // esbuild-register uses pirates.addHook which adds _extensions[ext] to Module
    const hasEsbuildRegistered = Boolean(require('module')._extensions['.ts']);
    if (hasEsbuildRegistered) {
        return (pathname) => {
            // eslint-disable-next-line security/detect-non-literal-require
            const result = require(pathname);
            return result.default || result;
        };
    }
    else {
        return (0, cosmiconfig_typescript_loader_1.TypeScriptLoader)();
    }
}
async function getProjectConfig(command, { env, storybook, ...argv }) {
    function getLoader(loader) {
        return async (pathname, content) => {
            const config = loader(pathname, content);
            if (typeof config === 'function') {
                return await config(command, env);
            }
            return config;
        };
    }
    const tsLoader = getLoader(getModuleLoader({ storybook }));
    const moduleName = 'app-builder';
    const explorer = (0, cosmiconfig_1.cosmiconfigSync)(moduleName, {
        cache: false,
        stopDir: process.cwd(),
        searchPlaces: [
            'package.json',
            `.${moduleName}rc`,
            `.${moduleName}rc.json`,
            `.${moduleName}rc.yaml`,
            `.${moduleName}rc.yml`,
            `.${moduleName}rc.js`,
            `.${moduleName}rc.ts`,
            `.${moduleName}rc.cjs`,
            `${moduleName}.config.js`,
            `${moduleName}.config.ts`,
            `${moduleName}.config.cjs`,
        ],
        loaders: {
            '.js': tsLoader,
            '.cjs': tsLoader,
            '.ts': tsLoader,
        },
    });
    let cfg;
    if (argv.config && typeof argv.config === 'string') {
        cfg = explorer.load(argv.config);
    }
    else {
        cfg = explorer.search();
    }
    const config = { verbose: false, ...(await cfg?.config) };
    if ((0, models_1.isLibraryConfig)(config)) {
        return normalizeConfig({
            ...config,
            ...omitUndefined({ verbose: argv.verbose }),
        });
    }
    const client = {
        analyzeBundle: argv.analyzeBundle,
        disableForkTsChecker: argv.disableForkTsChecker,
        disableReactRefresh: argv.disableReactRefresh,
        disableSourceMapGeneration: argv.disableSourceMapGeneration,
        entryFilter: argv.entryFilter,
        lazyCompilation: argv.lazyCompilation,
        reactProfiling: argv.reactProfiling,
    };
    const server = {
        inspect: argv.inspect,
        inspectBrk: argv.inspectBrk,
    };
    const projectConfig = {
        ...config,
        ...omitUndefined({ target: argv.target, verbose: argv.verbose }),
        client: {
            ...config.client,
            ...omitUndefined(client),
            ...(argv.cdn === 'false' ? { cdn: undefined } : undefined),
            ...(argv.debugWebpack ? { debugWebpack: argv.debugWebpack } : undefined),
        },
        server: {
            ...config.server,
            ...omitUndefined(server),
        },
    };
    return normalizeConfig(projectConfig, command);
}
async function normalizeConfig(userConfig, mode) {
    if ((0, models_1.isServiceConfig)(userConfig)) {
        const clientConfig = typeof userConfig.client === 'object' ? userConfig.client : {};
        const client = await normalizeClientConfig(clientConfig, mode);
        client.verbose = userConfig.verbose;
        const serverConfig = typeof userConfig.server === 'object' ? userConfig.server : {};
        const server = {
            ...serverConfig,
            watch: serverConfig.watch && remapPaths(serverConfig.watch),
            verbose: userConfig.verbose,
            port: undefined,
            inspect: undefined,
            inspectBrk: undefined,
        };
        if (mode === 'dev') {
            if (serverConfig.port === true) {
                server.port = await (0, utils_1.getPort)({ port: 3000 });
            }
            else {
                server.port = serverConfig.port;
            }
            if (serverConfig.inspect !== undefined) {
                server.inspect = serverConfig.inspect === true ? 9229 : serverConfig.inspect;
            }
            if (serverConfig.inspectBrk !== undefined) {
                server.inspectBrk =
                    serverConfig.inspectBrk === true ? 9229 : serverConfig.inspectBrk;
            }
        }
        const config = {
            ...userConfig,
            client,
            server,
        };
        return config;
    }
    const config = structuredClone(userConfig);
    config.lib.newJsxTransform = config.lib.newJsxTransform ?? true;
    return config;
}
async function normalizeClientConfig(client, mode) {
    const normalizedConfig = {
        ...client,
        forkTsChecker: client.disableForkTsChecker ? false : client.forkTsChecker,
        reactRefresh: client.disableReactRefresh
            ? false
            : (client.reactRefresh ?? ((options) => options)),
        newJsxTransform: client.newJsxTransform ?? true,
        publicPathPrefix: client.publicPathPrefix || '',
        modules: client.modules && remapPaths(client.modules),
        includes: client.includes && remapPaths(client.includes),
        images: client.images && remapPaths(client.images),
        hiddenSourceMap: client.hiddenSourceMap ?? true,
        svgr: client.svgr ?? {},
        entryFilter: client.entryFilter && splitPaths(client.entryFilter),
        webpack: typeof client.webpack === 'function' ? client.webpack : (config) => config,
        rspack: typeof client.rspack === 'function' ? client.rspack : (config) => config,
        babel: typeof client.babel === 'function' ? client.babel : (config) => config,
        swc: typeof client.swc === 'function' ? client.swc : (config) => config,
        devServer: undefined,
        lazyCompilation: undefined,
        bundler: client.bundler || 'webpack',
        javaScriptLoader: client.javaScriptLoader || 'babel',
    };
    if (mode === 'dev') {
        if (client.lazyCompilation) {
            if (client.lazyCompilation === true) {
                normalizedConfig.lazyCompilation = {
                    port: await (0, utils_1.getPort)({ port: 6000 }),
                };
            }
            else {
                normalizedConfig.lazyCompilation = client.lazyCompilation;
            }
            if (!normalizedConfig.lazyCompilation.port) {
                normalizedConfig.lazyCompilation.port = await (0, utils_1.getPort)({ port: 6000 });
            }
        }
        const devServer = client.devServer?.port
            ? {
                port: client.devServer.port === true
                    ? await (0, utils_1.getPort)({ port: 8000 })
                    : client.devServer.port,
                ipc: undefined,
            }
            : { port: undefined, ipc: client.devServer?.ipc };
        const { type, options, ...other } = client.devServer ?? {};
        normalizedConfig.devServer = {
            ...other,
            ...devServer,
            server: {
                type,
                options,
            },
        };
        delete normalizedConfig.cdn;
    }
    return normalizedConfig;
}
