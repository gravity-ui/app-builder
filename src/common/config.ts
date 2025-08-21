import * as path from 'node:path';

import {cosmiconfigSync} from 'cosmiconfig';
import {TypeScriptLoader as getTsLoader} from 'cosmiconfig-typescript-loader';

import {isLibraryConfig, isServiceConfig} from './models';

import type {Loader} from 'cosmiconfig';
import type {CosmiconfigResult} from 'cosmiconfig/dist/types';

import type {
    ClientConfig,
    LibraryConfig,
    NormalizedClientConfig,
    NormalizedServerConfig,
    NormalizedServiceConfig,
    ProjectConfig,
    ServerConfig,
    ServiceConfig,
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
    const newObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            newObj[key] = value;
        }
    }
    return newObj;
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

    const config = {verbose: false, ...(await cfg?.config)};
    if (isLibraryConfig(config)) {
        return normalizeConfig({
            ...config,
            ...omitUndefined({verbose: argv.verbose}),
        });
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

    const projectConfig: ServiceConfig = {
        ...config,
        ...omitUndefined({target: argv.target, verbose: argv.verbose}),
        client: {
            ...config.client,
            ...omitUndefined(client),
            ...(argv.cdn === 'false' ? {cdn: undefined} : undefined),
            ...(argv.debugWebpack ? {debugWebpack: argv.debugWebpack} : undefined),
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
        const clientConfig = typeof userConfig.client === 'object' ? userConfig.client : {};
        const client = await normalizeClientConfig(clientConfig, mode);
        client.verbose = userConfig.verbose;

        const serverConfig = typeof userConfig.server === 'object' ? userConfig.server : {};
        const server: NormalizedServerConfig = {
            ...serverConfig,
            watch: serverConfig.watch && remapPaths(serverConfig.watch),
            verbose: userConfig.verbose,
            port: undefined,
            inspect: undefined,
            inspectBrk: undefined,
            compiler: serverConfig.compiler || 'typescript',
        };
        if (mode === 'dev') {
            if (serverConfig.port === true) {
                server.port = await getPort({port: 3000});
            } else {
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
        const config: NormalizedServiceConfig = {
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

async function normalizeClientConfig(client: ClientConfig, mode?: 'dev' | 'build' | string) {
    let publicPath = client.publicPath || path.normalize(`${client.publicPathPrefix || ''}/build/`);

    if (client.moduleFederation) {
        publicPath = path.normalize(`${publicPath}${client.moduleFederation.name}/`);
    }

    const normalizedConfig: NormalizedClientConfig = {
        ...client,
        forkTsChecker: client.disableForkTsChecker ? false : client.forkTsChecker,
        reactRefresh: client.disableReactRefresh
            ? false
            : (client.reactRefresh ?? ((options) => options)),
        newJsxTransform: client.newJsxTransform ?? true,
        publicPath,
        assetsManifestFile:
            client.assetsManifestFile ||
            (client.moduleFederation?.version
                ? `assets-manifest-${client.moduleFederation.version}.json`
                : 'assets-manifest.json'),
        modules: client.modules && remapPaths(client.modules),
        includes: client.includes && remapPaths(client.includes),
        images: client.images && remapPaths(client.images),
        hiddenSourceMap: client.hiddenSourceMap ?? true,
        svgr: client.svgr ?? {},
        entryFilter: client.entryFilter && splitPaths(client.entryFilter),
        transformCssWithLightningCss: Boolean(
            client.transformCssWithLightningCss && !client.moduleFederation?.isolateStyles,
        ),
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
                    port: await getPort({port: 6000}),
                };
            } else {
                normalizedConfig.lazyCompilation = client.lazyCompilation;
            }
            if (!normalizedConfig.lazyCompilation.port) {
                normalizedConfig.lazyCompilation.port = await getPort({port: 6000});
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
