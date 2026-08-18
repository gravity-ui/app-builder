import * as path from 'node:path';
import {createRequire} from 'node:module';

import {cosmiconfig} from 'cosmiconfig';
import {TypeScriptLoader as getTsLoader} from 'cosmiconfig-typescript-loader';
import {stripIndent} from 'common-tags';

import {isLibraryConfig, isServiceConfig} from './models/index.js';
import paths from './paths.js';

import type {CosmiconfigResult} from 'cosmiconfig';

import type {
    ClientConfig,
    LibraryConfig,
    NormalizedClientConfig,
    NormalizedClientRspackConfig,
    NormalizedClientWebpackConfig,
    NormalizedServerConfig,
    NormalizedServiceConfig,
    ProjectConfig,
    PublicPathFallback,
    PublicPathFallbackEntry,
    ServerConfig,
    ServiceConfig,
} from './models/index.js';
import type {CliArgs} from '../create-cli.js';
import {getPort, hasMFAssetsIsolation} from './utils.js';
import logger from './logger/index.js';

const require = createRequire(import.meta.url);

function splitPaths(paths: string | string[]) {
    return (Array.isArray(paths) ? paths : [paths]).flatMap((p) => p.split(','));
}

function remapPaths(paths: string | string[]) {
    return splitPaths(paths).map((p) => path.resolve(process.cwd(), p));
}

function withTrailingSlash(publicPath: string) {
    // `path.normalize` yields backslashes on win32, so accept either separator
    return /[\\/]$/.test(publicPath) ? publicPath : `${publicPath}/`;
}

function normalizeHostPatterns(hosts: PublicPathFallbackEntry['hosts']) {
    if (!hosts) {
        return undefined;
    }

    const patterns = (Array.isArray(hosts) ? hosts : [hosts]).map((host) => ({
        // A string is an exact `location.hostname` match, a RegExp is used as is.
        source:
            typeof host === 'string'
                ? `^${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
                : host.source,
        // `location.hostname` is always lower case, and `g`/`y` would make `test` stateful
        flags: `i${typeof host === 'string' ? '' : host.flags.replace(/[giy]/g, '')}`,
    }));

    return patterns.length > 0 ? patterns : undefined;
}

function normalizePublicPathFallbacks(client: ClientConfig, mode?: string): PublicPathFallback[] {
    if (!client.publicPathFallback?.length || mode === 'dev') {
        return [];
    }

    if (client.moduleFederation) {
        logger.warning(
            stripIndent`
                publicPathFallback option is disabled because moduleFederation is configured.
                Module federation remotes load their entries and chunks through their own runtime,
                which the fallback cannot reach.
            `,
        );
        return [];
    }

    const candidates: PublicPathFallback[] = [];
    for (const entry of client.publicPathFallback) {
        const {publicPath, hosts} = typeof entry === 'string' ? {publicPath: entry} : entry;

        if (!publicPath) {
            continue;
        }

        const candidate = {
            publicPath: withTrailingSlash(publicPath),
            hosts: normalizeHostPatterns(hosts),
        };

        // Keep the first occurrence, so declaration order stays priority order
        if (!candidates.some((added) => added.publicPath === candidate.publicPath)) {
            candidates.push(omitUndefined(candidate) as PublicPathFallback);
        }
    }

    return candidates;
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
    const tsLoader = getModuleLoader({storybook});

    const moduleName = 'app-builder';
    const explorer = cosmiconfig(moduleName, {
        cache: false,
        stopDir: process.cwd(),
        searchPlaces: [
            'package.json',
            `.${moduleName}rc`,
            `.${moduleName}rc.json`,
            `.${moduleName}rc.yaml`,
            `.${moduleName}rc.yml`,
            `.${moduleName}rc.js`,
            `.${moduleName}rc.mjs`,
            `.${moduleName}rc.ts`,
            `.${moduleName}rc.mts`,
            `.${moduleName}rc.cjs`,
            `${moduleName}.config.js`,
            `${moduleName}.config.mjs`,
            `${moduleName}.config.ts`,
            `${moduleName}.config.mts`,
            `${moduleName}.config.cjs`,
        ],
        loaders: {
            '.ts': tsLoader,
            '.mts': tsLoader,
        },
    });

    let cfg: CosmiconfigResult;
    if (argv.config && typeof argv.config === 'string') {
        cfg = await explorer.load(argv.config);
    } else {
        cfg = await explorer.search();
    }

    const loadedConfig =
        typeof cfg?.config === 'function' ? await cfg.config(command, env) : await cfg?.config;
    const config = {verbose: false, ...loadedConfig};
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

    if (projectConfig.client?.moduleFederation && argv.mfRemotes) {
        projectConfig.client.moduleFederation.enabledRemotes = argv.mfRemotes;
    }

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
            outputPath: path.resolve(
                paths.appDist,
                serverConfig.outputPath ? serverConfig.outputPath : 'server',
            ),
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

    return structuredClone(userConfig);
}

function getBundlerOptions(client: ClientConfig) {
    if (client.bundler === 'rspack') {
        const rspackConfig: NormalizedClientRspackConfig = {
            bundler: 'rspack',
            webpack: undefined,
            rspack: typeof client.rspack === 'function' ? client.rspack : (config) => config,
            detectCircularDependencies: client.detectCircularDependencies,
        };

        return rspackConfig;
    }

    const webpackConfig: NormalizedClientWebpackConfig = {
        bundler: 'webpack',
        rspack: undefined,
        webpack: typeof client.webpack === 'function' ? client.webpack : (config) => config,
        detectCircularDependencies: client.detectCircularDependencies,
    };

    return webpackConfig;
}

// TODO(DakEnviy): Make mode type strict
async function normalizeClientConfig(client: ClientConfig, mode?: 'dev' | 'build' | string) {
    const cdnConfig = Array.isArray(client.cdn) ? client.cdn[0] : client.cdn;

    let publicPath = client.publicPath || path.normalize(`${client.publicPathPrefix || ''}/build/`);
    let browserPublicPath = (mode !== 'dev' && cdnConfig?.publicPath) || publicPath;

    if (hasMFAssetsIsolation(client.moduleFederation)) {
        publicPath = `${publicPath}${client.moduleFederation.name}/`;
        browserPublicPath = `${browserPublicPath}${client.moduleFederation.name}/`;
    }

    let transformCssWithLightningCss = Boolean(client.transformCssWithLightningCss);

    if (client.moduleFederation?.isolateStyles && transformCssWithLightningCss) {
        transformCssWithLightningCss = false;
        logger.warning(
            stripIndent`
                transformCssWithLightningCss option is disabled because moduleFederation.isolateStyles is enabled.
                postcss loader will be used instead.
            `,
        );
    }

    const normalizedConfig: NormalizedClientConfig = {
        ...client,
        forkTsChecker: client.disableForkTsChecker ? false : client.forkTsChecker,
        reactRefresh: client.disableReactRefresh
            ? false
            : (client.reactRefresh ?? ((options) => options)),
        publicPath,
        cdnPublicPath: cdnConfig?.publicPath,
        browserPublicPath,
        publicPathFallbacks: normalizePublicPathFallbacks(client, mode),
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
        transformCssWithLightningCss,
        ...getBundlerOptions(client),
        babel: typeof client.babel === 'function' ? client.babel : (config) => config,
        swc: typeof client.swc === 'function' ? client.swc : (config) => config,
        devServer: undefined,
        lazyCompilation: undefined,
        javaScriptLoader: client.javaScriptLoader || 'babel',
        cssLoaderConfig: {
            url: client.cssLoader?.url ?? {
                filter: (url: string) => !url.startsWith('data:'),
            },
            sourceMap: client.cssLoader?.sourceMap ?? !client.disableSourceMapGeneration,
            modules:
                typeof client.cssLoader?.modules === 'object'
                    ? {
                          auto: true,
                          localIdentName: '[name]__[local]--[hash:base64:5]',
                          exportLocalsConvention: 'camelCase',
                          ...client.cssLoader.modules,
                      }
                    : (client.cssLoader?.modules ?? {
                          auto: true,
                          localIdentName: '[name]__[local]--[hash:base64:5]',
                          exportLocalsConvention: 'camelCase',
                      }),
            import: client.cssLoader?.import,
            esModule: client.cssLoader?.esModule,
            exportType: client.cssLoader?.exportType,
        },
        reactCompiler: client.reactCompiler ?? false,
        postCssLoaderOptions:
            typeof client.postCssLoaderOptions === 'function'
                ? client.postCssLoaderOptions
                : (config) => config,
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
