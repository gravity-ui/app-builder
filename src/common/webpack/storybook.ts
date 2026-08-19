import * as path from 'node:path';
import {createRequire} from 'node:module';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import MiniCSSExtractPlugin from 'mini-css-extract-plugin';
import OptimizeCSSAssetsPlugin from 'css-minimizer-webpack-plugin';
import {rspack} from '@rspack/core';

import {
    WebpackMode,
    configureModuleRules,
    configureOptimization,
    configureResolve,
    configureRspackOptimization,
} from './config.js';
import {getProjectConfig, normalizeConfig} from '../config.js';
import {isLibraryConfig} from '../models/index.js';
import paths from '../paths.js';

import type {HelperOptions} from './config.js';
import type {
    ClientCommonConfig,
    ClientRspackConfig,
    ClientWebpackConfig,
    LibraryConfig,
    NormalizedClientConfig,
} from '../models/index.js';
import type * as Webpack from 'webpack';
import type * as Rspack from '@rspack/core';
import {getNormalizedWorkerOption} from './utils.js';

const require = createRequire(import.meta.url);

type Mode = `${WebpackMode}`;

function configureLibraryForStorybook(config: LibraryConfig): ClientCommonConfig {
    const libBabelPlugins = config.lib?.babelPlugins || [];

    return {
        includes: ['src'],
        babel: (babelConfig) => ({
            ...babelConfig,
            plugins: [...(babelConfig.plugins || []), ...libBabelPlugins],
        }),
    };
}

function getStorybookHelperOptions(mode: Mode, config: NormalizedClientConfig): HelperOptions {
    return {
        isEnvDevelopment: mode === WebpackMode.Dev,
        isEnvProduction: mode === WebpackMode.Prod,
        config,
        configType: mode,
        buildDirectory: config.outputPath || paths.appBuild,
        entriesDirectory: paths.appEntry,
        isSsr: false,
        webWorkerHandle: getNormalizedWorkerOption(config),
    };
}

export async function configureServiceWebpackConfig(
    mode: Mode,
    storybookConfig: Webpack.Configuration,
): Promise<Webpack.Configuration> {
    const serviceConfig = await getProjectConfig(mode === WebpackMode.Prod ? 'build' : 'dev', {
        storybook: true,
    });
    let options: ClientCommonConfig & ClientWebpackConfig = {};
    if (isLibraryConfig(serviceConfig)) {
        options = {
            ...configureLibraryForStorybook(serviceConfig),
            bundler: 'webpack',
        };
    } else if (serviceConfig.client.bundler === 'rspack') {
        throw new Error(
            'Rspack project config cannot be used by the Webpack Storybook builder. Use configureServiceRspackConfig instead.',
        );
    } else {
        options = serviceConfig.client;
    }

    const webpackConfig = await configureWebpackConfigForStorybook(
        mode,
        options,
        storybookConfig.module?.rules,
    );

    let devtool = storybookConfig.devtool;
    // storybook uses `cheap-module-source-map` and it's incompatible with `CssMinimizerWebpackPlugin`
    // also don't change devtool if it's disabled
    if (mode === WebpackMode.Prod && devtool) {
        devtool = 'source-map';
    }

    return {
        ...storybookConfig,
        devtool,
        plugins: [...(storybookConfig.plugins ?? []), ...webpackConfig.plugins],
        resolve: {
            ...storybookConfig.resolve,
            ...webpackConfig.resolve,
            alias: {
                ...storybookConfig.resolve?.alias,
                ...webpackConfig.resolve.alias,
            },
            modules: [
                ...(storybookConfig.resolve?.modules || []),
                ...(webpackConfig.resolve.modules || []),
            ],
            extensions: [
                ...(storybookConfig.resolve?.extensions ?? []),
                ...(webpackConfig.resolve.extensions || []),
            ],
            fallback: {
                ...storybookConfig.resolve?.fallback,
                ...webpackConfig.resolve.fallback,
            },
        },
        module: {
            ...storybookConfig.module,
            rules: webpackConfig.module.rules,
        },
        optimization: {
            ...storybookConfig.optimization,
            ...webpackConfig.optimization,
        },
    };
}

/**
 * Applies the service Rspack settings to the config created by Storybook's Rsbuild builder.
 *
 * @param mode Storybook build mode.
 * @param storybookConfig Rspack config created by the Storybook builder.
 * @returns The Storybook config extended with app-builder settings.
 */
export async function configureServiceRspackConfig(
    mode: Mode,
    storybookConfig: Rspack.Configuration,
): Promise<Rspack.Configuration> {
    const serviceConfig = await getProjectConfig(mode === WebpackMode.Prod ? 'build' : 'dev', {
        storybook: true,
    });

    let options: ClientCommonConfig & ClientRspackConfig;
    if (isLibraryConfig(serviceConfig)) {
        options = {
            ...configureLibraryForStorybook(serviceConfig),
            bundler: 'rspack',
        };
    } else if (serviceConfig.client.bundler === 'rspack') {
        options = serviceConfig.client;
    } else {
        throw new Error(
            'Webpack project config cannot be used by the Rspack Storybook builder. Use configureServiceWebpackConfig instead.',
        );
    }

    const rspackConfig = await configureRspackConfigForStorybook(
        mode,
        options,
        storybookConfig.module?.rules,
    );

    let devtool = storybookConfig.devtool;
    if (mode === WebpackMode.Prod && devtool) {
        devtool = 'source-map';
    }

    return {
        ...storybookConfig,
        devtool,
        plugins: [...(storybookConfig.plugins ?? []), ...rspackConfig.plugins],
        resolve: {
            ...storybookConfig.resolve,
            ...rspackConfig.resolve,
            alias: {
                ...storybookConfig.resolve?.alias,
                ...rspackConfig.resolve.alias,
            },
            modules: [
                ...(storybookConfig.resolve?.modules || []),
                ...(rspackConfig.resolve.modules || []),
            ],
            extensions: [
                ...(storybookConfig.resolve?.extensions ?? []),
                ...(rspackConfig.resolve.extensions || []),
            ],
            fallback: {
                ...storybookConfig.resolve?.fallback,
                ...rspackConfig.resolve.fallback,
            },
        },
        module: {
            ...storybookConfig.module,
            rules: rspackConfig.module.rules,
        },
        optimization: {
            ...storybookConfig.optimization,
            ...rspackConfig.optimization,
        },
    };
}

type WebpackModuleRule = NonNullable<NonNullable<Webpack.Configuration['module']>['rules']>[number];
export async function configureWebpackConfigForStorybook(
    mode: Mode,
    userConfig: ClientCommonConfig & ClientWebpackConfig = {},
    storybookModuleRules: WebpackModuleRule[] = [],
) {
    const config = await normalizeConfig({
        client: {
            ...userConfig,
            bundler: 'webpack',
            includes: (userConfig.includes ?? []).concat(['.storybook']),
        },
    });

    const helperOptions = getStorybookHelperOptions(mode, config.client);

    return {
        module: {
            rules: await configureModuleRules(
                helperOptions,
                storybookModuleRules.filter((rule) => rule !== '...') as Exclude<
                    WebpackModuleRule,
                    '...'
                >[],
            ),
        },
        resolve: configureResolve(helperOptions),
        plugins: configurePlugins(helperOptions),
        optimization: {
            minimizer: configureOptimization(helperOptions).minimizer,
        },
    };
}

type RspackModuleRule = NonNullable<NonNullable<Rspack.Configuration['module']>['rules']>[number];

export async function configureRspackConfigForStorybook(
    mode: Mode,
    userConfig: ClientCommonConfig & ClientRspackConfig = {bundler: 'rspack'},
    storybookModuleRules: RspackModuleRule[] = [],
) {
    const config = await normalizeConfig({
        client: {
            ...userConfig,
            bundler: 'rspack',
            ssr: undefined,
            includes: (userConfig.includes ?? []).concat(['.storybook']),
        },
    });

    const helperOptions = getStorybookHelperOptions(mode, config.client);
    const additionalRules = storybookModuleRules.filter(
        (rule) => rule !== '...',
    ) as unknown as NonNullable<Webpack.RuleSetRule['oneOf']>;

    return {
        module: {
            rules: (await configureModuleRules(
                helperOptions,
                additionalRules,
            )) as Rspack.RuleSetRules,
        },
        resolve: configureResolve(helperOptions) as NonNullable<Rspack.Configuration['resolve']>,
        plugins: configureRspackPlugins(helperOptions),
        optimization: {
            minimizer: configureRspackOptimization(helperOptions).minimizer,
        },
    };
}

function configurePlugins({isEnvDevelopment, isEnvProduction, config}: HelperOptions) {
    const plugins: Webpack.Configuration['plugins'] = [];

    if (config.definitions) {
        const webpack = require(
            path.resolve(process.cwd(), 'node_modules/webpack'),
        ) as typeof Webpack;
        plugins.push(
            new webpack.DefinePlugin({
                ...config.definitions,
            }),
        );
    }

    if (config.monaco) {
        plugins.push(createStorybookMonacoPlugin(config));
    }

    if (isEnvDevelopment && config.reactRefresh !== false) {
        plugins.push(new ReactRefreshWebpackPlugin(config.reactRefresh({})));
    }

    if (isEnvProduction) {
        plugins.push(
            new MiniCSSExtractPlugin({
                filename: 'css/[name].[contenthash:8].css',
                chunkFilename: 'css/[name].[contenthash:8].chunk.css',
                ignoreOrder: true,
            }),
        );

        plugins.push(
            new OptimizeCSSAssetsPlugin({
                minimizerOptions: {
                    preset: [
                        'default',
                        {
                            svgo: false,
                        },
                    ],
                },
            }),
        );
    }

    return plugins;
}

function configureRspackPlugins({config}: HelperOptions) {
    const plugins: NonNullable<Rspack.Configuration['plugins']> = [];

    if (config.definitions) {
        const definitions = {...config.definitions} as unknown as Rspack.DefinePluginOptions;
        plugins.push(new rspack.DefinePlugin(definitions));
    }

    if (config.monaco) {
        plugins.push(createStorybookMonacoPlugin(config) as unknown as Rspack.Plugin);
    }

    if (config.bundler === 'rspack' && config.detectCircularDependencies) {
        const options: Rspack.CircularDependencyRspackPluginOptions =
            typeof config.detectCircularDependencies === 'object'
                ? config.detectCircularDependencies
                : {exclude: /node_modules/};

        plugins.push(new rspack.CircularDependencyRspackPlugin(options));
    }

    return plugins;
}

function createStorybookMonacoPlugin(config: NormalizedClientConfig) {
    const MonacoEditorWebpackPlugin = require('monaco-editor-webpack-plugin');

    return new MonacoEditorWebpackPlugin({
        ...config.monaco,
        // currently, workers located on cdn are not working properly, so we are enforcing loading workers from
        // service instead
        publicPath: '/',
    });
}
