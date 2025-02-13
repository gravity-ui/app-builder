import * as path from 'node:path';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import MiniCSSExtractPlugin from 'mini-css-extract-plugin';
import OptimizeCSSAssetsPlugin from 'css-minimizer-webpack-plugin';

import {WebpackMode, configureModuleRules, configureOptimization, configureResolve} from './config';
import {getProjectConfig, normalizeConfig} from '../config';
import {isLibraryConfig} from '../models';
import paths from '../paths';

import type {HelperOptions} from './config';
import type {ClientConfig} from '../models';
import type * as Webpack from 'webpack';

type Mode = `${WebpackMode}`;

export async function configureServiceWebpackConfig(
    mode: Mode,
    storybookConfig: Webpack.Configuration,
): Promise<Webpack.Configuration> {
    const serviceConfig = await getProjectConfig(mode === WebpackMode.Prod ? 'build' : 'dev', {
        storybook: true,
    });
    let options: ClientConfig = {};
    if (isLibraryConfig(serviceConfig)) {
        options = {
            includes: ['src'],
            newJsxTransform: serviceConfig.lib?.newJsxTransform,
        };
    } else {
        options = serviceConfig.client;
    }

    options = {
        ...options,
        // TODO support rspack for storybook
        bundler: 'webpack',
    };

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

type ModuleRule = NonNullable<NonNullable<Webpack.Configuration['module']>['rules']>[number];
export async function configureWebpackConfigForStorybook(
    mode: Mode,
    userConfig: ClientConfig = {},
    storybookModuleRules: ModuleRule[] = [],
) {
    const isEnvDevelopment = mode === WebpackMode.Dev;
    const isEnvProduction = mode === WebpackMode.Prod;

    const config = await normalizeConfig({
        client: {
            ...userConfig,
            // TODO support rspack for storybook
            bundler: 'webpack',
            includes: (userConfig.includes ?? []).concat(['.storybook']),
        },
    });

    const helperOptions = {
        isEnvDevelopment,
        isEnvProduction,
        config: config.client,
        configType: mode,
        buildDirectory: paths.appBuild,
        entriesDirectory: paths.appEntry,
        isSsr: false,
    };

    return {
        module: {
            rules: configureModuleRules(
                helperOptions,
                storybookModuleRules.filter((rule) => rule !== '...') as Exclude<
                    ModuleRule,
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
        const MonacoEditorWebpackPlugin = require('monaco-editor-webpack-plugin');
        plugins.push(
            new MonacoEditorWebpackPlugin({
                ...config.monaco,
                // currently, workers located on cdn are not working properly, so we are enforcing loading workers from
                // service instead
                publicPath: '/',
            }),
        );
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
