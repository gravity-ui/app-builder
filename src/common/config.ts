import path from 'path';
import _ from 'lodash';

import {cosmiconfigSync} from 'cosmiconfig';
import {TypeScriptLoader as getTsLoader} from 'cosmiconfig-typescript-loader';

import {isLibraryConfig, isServiceConfig} from './models';

import type {Loader} from 'cosmiconfig';
import type {CosmiconfigResult} from 'cosmiconfig/dist/types';

import type {
    ProjectConfig,
    NormalizedServiceConfig,
    ServiceConfig,
    LibraryConfig,
    ClientConfig,
    ServerConfig,
    NormalizedClientConfig,
    NormalizedServerConfig,
} from './models';
import type {CliArgs} from '../create-cli';
import {getPort} from './utils';

function splitPaths(paths: string | string[]) {
    return (Array.isArray(paths) ? paths : [paths]).flatMap((p) => p.split(','));
}

function remapPaths(paths: string | string[]) {
    return splitPaths(paths).map((p) => path.resolve(process.cwd(), p));
}

function omitUndefined<T extends object>(obj: T) {
    return _.omitBy(obj, _.isUndefined);
}

function getModuleLoader({storybook}: {storybook?: boolean} = {}) {
    if (!storybook) {
        return getTsLoader();
    }

    // storybook 7 uses esbuild-register to compile ts to cjs
    // https://github.com/storybookjs/storybook/blob/c1ec290b3a74ce05b23f74250539ae571bffaa66/code/lib/core-common/src/utils/interpret-require.ts#L11
    // esbuild-register uses pirates.addHook which adds _extensions[ext] to Module
    const hasEsbuildRegistered = Boolean(require('module')._extensions['.ts']);
    if (hasEsbuildRegistered) {
        return (pathname: string) => {
            // eslint-disable-next-line security/detect-non-literal-require
            const result = require(pathname);
            return result.default || result;
        };
    } else {
        return getTsLoader();
    }
}

export async function getProjectConfig(
    command: string,
    {env, storybook, ...argv}: Partial<CliArgs> & {storybook?: boolean},
) {
    function getLoader(loader: Loader): Loader {
        return async (pathname: string, content: string) => {
            const config = loader(pathname, content);
            if (typeof config === 'function') {
                return await config(command, env);
            }
            return config;
        };
    }

    const tsLoader = getLoader(getModuleLoader({storybook}));

    const moduleName = 'app-builder';
    const explorer = cosmiconfigSync(moduleName, {
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

    let cfg: CosmiconfigResult;
    if (argv.config && typeof argv.config === 'string') {
        cfg = explorer.load(argv.config);
    } else {
        cfg = explorer.search();
    }

    const client: ClientConfig = {
        analyzeBundle: argv.analyzeBundle,
        disableForkTsChecker: argv.disableForkTsChecker,
        disableReactRefresh: argv.disableReactRefresh,
        disableSourceMapGeneration: argv.disableSourceMapGeneration,
        entryFilter: argv.entryFilter,
        lazyCompilation: argv.lazyCompilation,
        reactProfiling: argv.reactProfiling,
    };
    const server: ServerConfig = {
        inspect: argv.inspect,
        inspectBrk: argv.inspectBrk,
    };

    const config = {verbose: false, ...(await cfg?.config)};
    if (isLibraryConfig(config)) {
        return normalizeConfig({
            ...config,
            ...omitUndefined({verbose: argv.verbose}),
        });
    }

    const projectConfig: ServiceConfig = {
        ...config,
        ...omitUndefined({target: argv.target, verbose: argv.verbose}),
        client: {
            ...config.client,
            ...omitUndefined(client),
            ...(argv.cdn === 'false' ? {cdn: undefined} : undefined),
        },
        server: {
            ...config.server,
            ...omitUndefined(server),
        },
    };

    return normalizeConfig(projectConfig, command);
}

export function normalizeConfig(
    userConfig: ServiceConfig,
    mode?: 'dev' | 'build' | string,
): Promise<NormalizedServiceConfig>;

export function normalizeConfig(
    userConfig: LibraryConfig,
    mode?: 'dev' | 'build' | string,
): Promise<LibraryConfig>;

export async function normalizeConfig(userConfig: ProjectConfig, mode?: 'dev' | 'build' | string) {
    if (isServiceConfig(userConfig)) {
        const config = _.cloneDeep(userConfig);
        const client = typeof config.client === 'object' ? config.client : (config.client = {});
        await normalizeClientConfig(client, mode);
        (client as NormalizedClientConfig).verbose = userConfig.verbose;

        const server = typeof config.server === 'object' ? config.server : (config.server = {});
        server.watch = server.watch && remapPaths(server.watch);
        (server as NormalizedServerConfig).verbose = userConfig.verbose;

        if (mode === 'dev') {
            if (server.port === true) {
                server.port = await getPort({port: 3000});
            }
        }

        return config as NormalizedServiceConfig;
    }

    const config = _.cloneDeep(userConfig);
    config.lib.newJsxTransform = config.lib.newJsxTransform ?? true;
    return config;
}

async function normalizeClientConfig(client: ClientConfig, mode?: 'dev' | 'build' | string) {
    client.newJsxTransform = client.newJsxTransform ?? true;
    client.publicPathPrefix = client.publicPathPrefix || '';
    client.modules = client.modules && remapPaths(client.modules);
    client.includes = client.includes && remapPaths(client.includes);
    client.images = client.images && remapPaths(client.images);
    client.hiddenSourceMap = client.hiddenSourceMap ?? true;
    client.svgr = client.svgr ?? {};
    client.entryFilter = client.entryFilter && splitPaths(client.entryFilter);

    if (mode === 'dev') {
        if (client.lazyCompilation) {
            if (client.lazyCompilation === true) {
                client.lazyCompilation = {
                    port: await getPort({port: 6000}),
                };
            } else if (!client.lazyCompilation.port) {
                client.lazyCompilation.port = await getPort({port: 6000});
            }
        }

        const devServer = client.devServer?.port
            ? {
                  port:
                      client.devServer.port === true
                          ? await getPort({port: 8000})
                          : client.devServer.port,
                  ipc: undefined,
              }
            : {port: undefined, ipc: client.devServer?.ipc};

        const {type, options, ...other} = client.devServer ?? {};
        (client as NormalizedClientConfig).devServer = {
            ...other,
            ...devServer,
            server: {
                type,
                options,
            },
        };
        delete client.cdn;
    } else {
        delete client.devServer;
        delete client.lazyCompilation;
    }
}
