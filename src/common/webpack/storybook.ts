import path from 'path';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import MiniCSSExtractPlugin from 'mini-css-extract-plugin';
import OptimizeCSSAssetsPlugin from 'css-minimizer-webpack-plugin';

import {configureModuleRules, configureResolve, HelperOptions, WebpackMode} from './config';
import type {WebpackConfig} from '../models';
import type * as Webpack from 'webpack';
import {getProjectConfig, normalizeConfig} from '../config';
import {isServiceConfig} from '../models';

type Mode = `${WebpackMode}`;

export async function configureServiceWebpackConfig(
    mode: Mode,
    storybookConfig: Webpack.Configuration,
): Promise<Webpack.Configuration> {
    const serviceConfig = await getProjectConfig(mode === WebpackMode.Prod ? 'build' : 'dev', {});
    if (!isServiceConfig(serviceConfig)) {
        throw new Error(
            'configureServiceWebpackConfig can be used only for services, but got the library config',
        );
    }

    const webpackConfig = await configureWebpackConfigForStorybook(mode, serviceConfig);

    return {
        ...storybookConfig,
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
        },
        module: {
            ...storybookConfig.module,
            rules: webpackConfig.module.rules,
        },
    };
}

export async function configureWebpackConfigForStorybook(mode: Mode, userConfig: WebpackConfig) {
    const isEnvDevelopment = mode === WebpackMode.Dev;
    const isEnvProduction = mode === WebpackMode.Prod;

    const config = await normalizeConfig({
        ...userConfig,
        includes: (userConfig.includes ?? []).concat(['.storybook']),
    });

    const helperOptions = {
        isEnvDevelopment,
        isEnvProduction,
        config,
    };

    return {
        module: {
            rules: configureModuleRules(helperOptions),
        },
        resolve: configureResolve(helperOptions),
        plugins: configurePlugins(helperOptions),
    };
}

function configurePlugins({isEnvDevelopment, isEnvProduction, config}: HelperOptions) {
    const plugins: Webpack.Configuration['plugins'] = [];

    if (config.definitions) {
        // eslint-disable-next-line security/detect-non-literal-require
        const webpack = require(path.resolve(
            process.cwd(),
            'node_modules/webpack',
        )) as typeof Webpack;
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

    if (isEnvDevelopment) {
        plugins.push(new ReactRefreshWebpackPlugin());
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
