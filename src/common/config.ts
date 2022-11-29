import path from 'path';
import _ from 'lodash';

import {cosmiconfigSync, Loader} from 'cosmiconfig';
import type {CosmiconfigResult} from 'cosmiconfig/dist/types';
import {TypeScriptLoader as getTsLoader} from 'cosmiconfig-typescript-loader';
import getPort from 'get-port';

import {isServiceConfig} from './models';

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

function splitPaths(paths: string | string[]) {
    return (Array.isArray(paths) ? paths : [paths]).flatMap((p) => p.split(','));
}

function remapPaths(paths: string | string[]) {
    return splitPaths(paths).map((p) => path.resolve(process.cwd(), p));
}

function omitUndefined<T extends object>(obj: T) {
    return _.omitBy(obj, _.isUndefined);
}

export async function getProjectConfig(command: string, {env, ...argv}: Partial<CliArgs>) {
    function getLoader(loader: Loader): Loader {
        return async (pathname: string, content: string) => {
            const config = loader(pathname, content);
            if (typeof config === 'function') {
                return await config(command, env);
            }
            return config;
        };
    }

    const tsLoader = getLoader(getTsLoader());

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

    const config = {...(await cfg?.config)};
    const projectConfig: ProjectConfig = {
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
    config.newJsxTransform = config.newJsxTransform ?? true;
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
