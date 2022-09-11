import path from 'path';
import _ from 'lodash';

import {cosmiconfigSync, Loader} from 'cosmiconfig';
import type {CosmiconfigResult} from 'cosmiconfig/dist/types';
import {TypeScriptLoader as getTsLoader} from 'cosmiconfig-typescript-loader';
import getPort from 'get-port';

import type yargs from 'yargs';

import type {ProjectConfig, NormalizedServiceConfig, ServiceConfig, LibraryConfig} from './models';
import {isServiceConfig} from './models';

function splitPaths(paths: string | string[]) {
    return (Array.isArray(paths) ? paths : [paths]).flatMap((p) => p.split(','));
}

function remapPaths(paths: string | string[]) {
    return splitPaths(paths).map((p) => path.resolve(process.cwd(), p));
}

export async function getProjectConfig(
    command: string,
    {env, ...argv}: Partial<yargs.Arguments> = {},
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

    const projectConfig: ProjectConfig = {...(await cfg?.config), ...argv};
    projectConfig.newJsxTransform = projectConfig.newJsxTransform ?? false;

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
        config.publicPathPrefix = config.publicPathPrefix || '';
        config.modules = config.modules && remapPaths(config.modules);
        config.includes = config.includes && remapPaths(config.includes);
        config.images = config.images && remapPaths(config.images);
        config.serverWatch = config.serverWatch && remapPaths(config.serverWatch);
        config.hiddenSourceMap = config.hiddenSourceMap ?? true;
        config.svgr = config.svgr ?? {};
        config.entryFilter = config.entryFilter && splitPaths(config.entryFilter);

        if (mode === 'dev') {
            if (config.lazyCompilation) {
                if (config.lazyCompilation === true) {
                    config.lazyCompilation = {
                        port: await getPort({port: 6000}),
                    };
                } else if (!config.lazyCompilation.port) {
                    config.lazyCompilation.port = await getPort({port: 6000});
                }
            }

            const devServer = config.devServer?.port
                ? {
                      port:
                          config.devServer.port === true
                              ? await getPort({port: 8000})
                              : config.devServer.port,
                      ipc: undefined,
                  }
                : {port: undefined, ipc: config.devServer?.ipc};

            const {type, options, ...other} = config.devServer ?? {};
            (config as NormalizedServiceConfig).devServer = {
                ...other,
                ...devServer,
                server: {
                    type,
                    options,
                },
            };

            if (config.serverPort === true) {
                config.serverPort = await getPort({port: 3000});
            }
        } else {
            delete config.devServer;
            delete config.lazyCompilation;
        }

        return config as NormalizedServiceConfig;
    }

    return userConfig;
}
