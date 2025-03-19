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
exports.configureServiceWebpackConfig = configureServiceWebpackConfig;
exports.configureWebpackConfigForStorybook = configureWebpackConfigForStorybook;
const path = __importStar(require("node:path"));
const react_refresh_webpack_plugin_1 = __importDefault(require("@pmmmwh/react-refresh-webpack-plugin"));
const mini_css_extract_plugin_1 = __importDefault(require("mini-css-extract-plugin"));
const css_minimizer_webpack_plugin_1 = __importDefault(require("css-minimizer-webpack-plugin"));
const config_1 = require("./config");
const config_2 = require("../config");
const models_1 = require("../models");
const paths_1 = __importDefault(require("../paths"));
async function configureServiceWebpackConfig(mode, storybookConfig) {
    const serviceConfig = await (0, config_2.getProjectConfig)(mode === "production" /* WebpackMode.Prod */ ? 'build' : 'dev', {
        storybook: true,
    });
    let options = {};
    if ((0, models_1.isLibraryConfig)(serviceConfig)) {
        options = {
            includes: ['src'],
            newJsxTransform: serviceConfig.lib?.newJsxTransform,
        };
    }
    else {
        options = serviceConfig.client;
    }
    options = {
        ...options,
        // TODO support rspack for storybook
        bundler: 'webpack',
    };
    const webpackConfig = await configureWebpackConfigForStorybook(mode, options, storybookConfig.module?.rules);
    let devtool = storybookConfig.devtool;
    // storybook uses `cheap-module-source-map` and it's incompatible with `CssMinimizerWebpackPlugin`
    // also don't change devtool if it's disabled
    if (mode === "production" /* WebpackMode.Prod */ && devtool) {
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
async function configureWebpackConfigForStorybook(mode, userConfig = {}, storybookModuleRules = []) {
    const isEnvDevelopment = mode === "development" /* WebpackMode.Dev */;
    const isEnvProduction = mode === "production" /* WebpackMode.Prod */;
    const config = await (0, config_2.normalizeConfig)({
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
        buildDirectory: paths_1.default.appBuild,
        entriesDirectory: paths_1.default.appEntry,
        isSsr: false,
    };
    return {
        module: {
            rules: await (0, config_1.configureModuleRules)(helperOptions, storybookModuleRules.filter((rule) => rule !== '...')),
        },
        resolve: (0, config_1.configureResolve)(helperOptions),
        plugins: configurePlugins(helperOptions),
        optimization: {
            minimizer: (0, config_1.configureOptimization)(helperOptions).minimizer,
        },
    };
}
function configurePlugins({ isEnvDevelopment, isEnvProduction, config }) {
    const plugins = [];
    if (config.definitions) {
        const webpack = require(path.resolve(process.cwd(), 'node_modules/webpack'));
        plugins.push(new webpack.DefinePlugin({
            ...config.definitions,
        }));
    }
    if (config.monaco) {
        const MonacoEditorWebpackPlugin = require('monaco-editor-webpack-plugin');
        plugins.push(new MonacoEditorWebpackPlugin({
            ...config.monaco,
            // currently, workers located on cdn are not working properly, so we are enforcing loading workers from
            // service instead
            publicPath: '/',
        }));
    }
    if (isEnvDevelopment && config.reactRefresh !== false) {
        plugins.push(new react_refresh_webpack_plugin_1.default(config.reactRefresh({})));
    }
    if (isEnvProduction) {
        plugins.push(new mini_css_extract_plugin_1.default({
            filename: 'css/[name].[contenthash:8].css',
            chunkFilename: 'css/[name].[contenthash:8].chunk.css',
            ignoreOrder: true,
        }));
        plugins.push(new css_minimizer_webpack_plugin_1.default({
            minimizerOptions: {
                preset: [
                    'default',
                    {
                        svgo: false,
                    },
                ],
            },
        }));
    }
    return plugins;
}
