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
exports.webpackConfigFactory = webpackConfigFactory;
exports.rspackConfigFactory = rspackConfigFactory;
exports.configureModuleRules = configureModuleRules;
exports.configureResolve = configureResolve;
exports.configureOptimization = configureOptimization;
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const webpack = __importStar(require("webpack"));
const clean_webpack_plugin_1 = require("clean-webpack-plugin");
const webpack_manifest_plugin_1 = require("webpack-manifest-plugin");
const fork_ts_checker_webpack_plugin_1 = __importDefault(require("fork-ts-checker-webpack-plugin"));
const mini_css_extract_plugin_1 = __importDefault(require("mini-css-extract-plugin"));
const webpack_bundle_analyzer_1 = require("webpack-bundle-analyzer");
const webpack_assets_manifest_1 = __importDefault(require("webpack-assets-manifest"));
const rspack_manifest_plugin_1 = require("rspack-manifest-plugin");
const react_refresh_webpack_plugin_1 = __importDefault(require("@pmmmwh/react-refresh-webpack-plugin"));
const moment_timezone_data_webpack_plugin_1 = __importDefault(require("moment-timezone-data-webpack-plugin"));
const webpack_plugin_1 = __importDefault(require("@statoscope/webpack-plugin"));
const circular_dependency_plugin_1 = __importDefault(require("circular-dependency-plugin"));
const core_1 = require("@rspack/core");
const rspack_1 = require("./rspack");
const ts_checker_rspack_plugin_1 = require("ts-checker-rspack-plugin");
const plugin_react_refresh_1 = __importDefault(require("@rspack/plugin-react-refresh"));
const paths_1 = __importDefault(require("../paths"));
const babel_1 = require("../babel");
const progress_plugin_1 = require("./progress-plugin");
const utils_1 = require("./utils");
const s3_upload_1 = require("../s3-upload");
const log_config_1 = require("../logger/log-config");
const utils_2 = require("../typescript/utils");
const node_externals_1 = require("./node-externals");
const statoscope_1 = require("./statoscope");
const imagesSizeLimit = 2048;
const fontSizeLimit = 8192;
const assetsManifestFile = 'assets-manifest.json';
function getHelperOptions({ webpackMode, config, logger, isSsr = false, }) {
    const isEnvDevelopment = webpackMode === "development" /* WebpackMode.Dev */;
    const isEnvProduction = webpackMode === "production" /* WebpackMode.Prod */;
    return {
        config,
        logger,
        isEnvDevelopment,
        isEnvProduction,
        configType: webpackMode,
        buildDirectory: isSsr ? paths_1.default.appSsrBuild : paths_1.default.appBuild,
        entriesDirectory: isSsr ? paths_1.default.appSsrEntry : paths_1.default.appEntry,
        isSsr,
    };
}
function configureExternals({ config, isSsr }) {
    let externals = config.externals;
    if (isSsr) {
        externals =
            config.ssr?.noExternal === true
                ? undefined
                : (0, node_externals_1.nodeExternals)({
                    noExternal: config.ssr?.noExternal,
                    module: config.ssr?.moduleType === 'esm',
                });
    }
    return externals;
}
async function webpackConfigFactory(options) {
    const { config } = options;
    const helperOptions = getHelperOptions(options);
    const { isSsr, isEnvProduction } = helperOptions;
    let webpackConfig = {
        mode: isEnvProduction ? 'production' : 'development',
        context: paths_1.default.app,
        bail: isEnvProduction,
        target: isSsr ? 'node' : undefined,
        devtool: configureDevTool(helperOptions),
        entry: configureEntry(helperOptions),
        output: configureOutput(helperOptions),
        resolve: configureResolve(helperOptions),
        module: {
            rules: await configureModuleRules(helperOptions),
        },
        plugins: configureWebpackPlugins(helperOptions),
        optimization: configureOptimization(helperOptions),
        externals: configureExternals(helperOptions),
        node: config.node,
        watchOptions: configureWatchOptions(helperOptions),
        ignoreWarnings: [/Failed to parse source map/],
        infrastructureLogging: config.verbose
            ? {
                colors: true,
                level: 'verbose',
            }
            : undefined,
        experiments: configureExperiments(helperOptions),
        snapshot: {
            managedPaths: config.watchOptions?.watchPackages ? [] : undefined,
        },
        cache: config.cache,
    };
    webpackConfig = await config.webpack(webpackConfig, {
        configType: isEnvProduction ? 'production' : 'development',
        isSsr,
    });
    if (config.debugWebpack) {
        (0, log_config_1.logConfig)('Preview webpack config', webpackConfig);
    }
    return webpackConfig;
}
async function rspackConfigFactory(options) {
    const { config } = options;
    const helperOptions = getHelperOptions(options);
    const { isSsr, isEnvProduction, isEnvDevelopment } = helperOptions;
    // Cache is required for lazy compilation
    const cache = Boolean(config.cache) || (isEnvDevelopment && Boolean(config.lazyCompilation));
    let rspackConfig = {
        mode: isEnvProduction ? 'production' : 'development',
        context: paths_1.default.app,
        bail: isEnvProduction,
        target: isSsr ? 'node' : undefined,
        devtool: configureDevTool(helperOptions),
        entry: configureEntry(helperOptions),
        output: configureOutput(helperOptions),
        resolve: configureResolve(helperOptions),
        module: {
            rules: (await configureModuleRules(helperOptions)),
        },
        plugins: configureRspackPlugins(helperOptions),
        optimization: configureRspackOptimization(helperOptions),
        externals: configureExternals(helperOptions),
        node: config.node,
        watchOptions: configureWatchOptions(helperOptions),
        ignoreWarnings: [/Failed to parse source map/],
        infrastructureLogging: config.verbose
            ? {
                colors: true,
                level: 'verbose',
            }
            : undefined,
        experiments: configureRspackExperiments(helperOptions),
        cache,
    };
    rspackConfig = await config.rspack(rspackConfig, {
        configType: isEnvProduction ? 'production' : 'development',
        isSsr,
    });
    if (config.debugWebpack) {
        (0, log_config_1.logConfig)('Preview rspack config', rspackConfig);
    }
    return rspackConfig;
}
async function configureModuleRules(helperOptions, additionalRules = []) {
    const jsLoader = await createJavaScriptLoader(helperOptions);
    return [
        ...createSourceMapRules(!helperOptions.config.disableSourceMapGeneration),
        {
            oneOf: [
                await createWorkerRule(helperOptions),
                createJavaScriptRule(helperOptions, jsLoader),
                createStylesRule(helperOptions),
                createSassStylesRule(helperOptions),
                createIconsRule(helperOptions), // workaround for https://github.com/webpack/webpack/issues/9309
                createIconsRule(helperOptions, jsLoader),
                ...createAssetsRules(helperOptions),
                ...additionalRules,
                ...createFallbackRules(helperOptions),
            ],
        },
    ];
}
function configureDevTool({ isEnvProduction, config }) {
    let format = 'cheap-module-source-map';
    if (isEnvProduction) {
        format = config.hiddenSourceMap ? 'hidden-source-map' : 'source-map';
    }
    return config.disableSourceMapGeneration ? false : format;
}
function configureWatchOptions({ config }) {
    const watchOptions = {
        ...config.watchOptions,
        followSymlinks: (config.watchOptions?.followSymlinks ??
            (!config.symlinks && config.watchOptions?.watchPackages))
            ? true
            : undefined,
    };
    delete watchOptions.watchPackages;
    return watchOptions;
}
function configureExperiments({ config, isEnvProduction, isSsr, }) {
    if (isSsr) {
        return config.ssr?.moduleType === 'esm' ? { outputModule: true } : undefined;
    }
    if (isEnvProduction) {
        return undefined;
    }
    let lazyCompilation;
    let port;
    let entries;
    if (config.lazyCompilation) {
        if (typeof config.lazyCompilation === 'object') {
            port = config.lazyCompilation.port;
            entries = config.lazyCompilation.entries;
        }
        lazyCompilation = {
            backend: {
                client: require.resolve('./lazy-client.js'),
                ...(port
                    ? {
                        listen: {
                            port,
                        },
                    }
                    : {}),
            },
            entries,
        };
    }
    return {
        lazyCompilation,
    };
}
function configureRspackExperiments({ config, isEnvProduction, isSsr, }) {
    if (isSsr) {
        return config.ssr?.moduleType === 'esm' ? { outputModule: true } : undefined;
    }
    if (isEnvProduction) {
        return undefined;
    }
    let lazyCompilation;
    let port;
    if (config.lazyCompilation) {
        if (typeof config.lazyCompilation === 'object') {
            port = config.lazyCompilation.port;
        }
        lazyCompilation = {
            // Lazy compilation works without problems only with lazy imports
            // See https://github.com/web-infra-dev/rspack/issues/8503
            entries: false,
            imports: true,
            backend: {
                client: require.resolve('./lazy-client.js'),
                ...(port
                    ? {
                        listen: {
                            port,
                        },
                    }
                    : {}),
            },
            test(module) {
                // make sure that lazy-client.js won't be lazy compiled)
                return !module.nameForCondition()?.endsWith('lazy-client.js');
            },
        };
    }
    return {
        cache: {
            type: 'persistent',
            snapshot: {
                managedPaths: config.watchOptions?.watchPackages ? [] : undefined,
            },
            storage: {
                type: 'filesystem',
                directory: typeof config.cache === 'object' && 'cacheDirectory' in config.cache
                    ? config.cache.cacheDirectory
                    : undefined,
            },
        },
        lazyCompilation,
    };
}
function configureResolve({ isEnvProduction, config }) {
    const alias = { ...config.alias };
    for (const [key, value] of Object.entries(alias)) {
        alias[key] = path.resolve(paths_1.default.app, value);
    }
    if (isEnvProduction && config.reactProfiling) {
        alias['react-dom$'] = 'react-dom/profiling';
        alias['scheduler/tracing'] = 'scheduler/tracing-profiling';
    }
    const { aliases, modules = [] } = (0, utils_1.resolveTsConfigPathsToAlias)(paths_1.default.appClient);
    return {
        alias: {
            ...aliases,
            ...alias,
        },
        modules: ['node_modules', ...modules, ...(config.modules || [])],
        extensions: ['.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
        symlinks: config.symlinks,
        fallback: config.fallback,
    };
}
function createEntryArray(entry) {
    return [require.resolve('./public-path'), entry];
}
function addEntry(entry, file) {
    return {
        ...entry,
        [path.parse(file).name]: createEntryArray(file),
    };
}
function configureEntry({ config, entriesDirectory }) {
    let entries = fs.readdirSync(entriesDirectory).filter((file) => /\.[jt]sx?$/.test(file));
    if (Array.isArray(config.entryFilter) && config.entryFilter.length) {
        entries = entries.filter((entry) => config.entryFilter?.includes(entry.split('.')[0] ?? ''));
    }
    if (!entries.length) {
        throw new Error('No entries were found after applying entry filter');
    }
    return entries.reduce((entry, file) => addEntry(entry, path.resolve(entriesDirectory, file)), {});
}
function getFileNames({ isEnvProduction, isSsr, config }) {
    let ext = 'js';
    if (isSsr) {
        ext = config.ssr?.moduleType === 'esm' ? 'mjs' : 'cjs';
    }
    return {
        filename: isEnvProduction ? `js/[name].[contenthash:8].${ext}` : `js/[name].${ext}`,
        chunkFilename: isEnvProduction
            ? 'js/[name].[contenthash:8].chunk.js'
            : 'js/[name].chunk.js',
    };
}
function configureOutput(options) {
    let ssrOptions;
    if (options.isSsr) {
        ssrOptions = {
            library: { type: options.config.ssr?.moduleType === 'esm' ? 'module' : 'commonjs2' },
            chunkFormat: false,
        };
    }
    return {
        ...getFileNames(options),
        path: options.buildDirectory,
        pathinfo: options.isEnvDevelopment,
        ...ssrOptions,
    };
}
async function createJavaScriptLoader({ isEnvProduction, isEnvDevelopment, configType, config, isSsr, }) {
    if (config.javaScriptLoader === 'swc') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plugins = [];
        if (config.bundler !== 'rspack' && !isSsr && isEnvProduction) {
            plugins.push([
                require.resolve('@swc/plugin-transform-imports'),
                {
                    lodash: { transform: 'lodash/{{member}}' },
                },
            ]);
        }
        const swcConfig = await config.swc({
            module: {
                type: 'es6',
            },
            env: {
                targets: isSsr ? { node: process.versions.node } : require('browserslist')(),
                mode: 'usage',
                coreJs: '3.40',
                bugfixes: true,
            },
            isModule: 'unknown',
            jsc: {
                parser: {
                    syntax: 'typescript',
                    tsx: true,
                },
                transform: {
                    react: {
                        runtime: config.newJsxTransform ? 'automatic' : 'classic',
                        development: isEnvDevelopment,
                        refresh: !isSsr && isEnvDevelopment && config.reactRefresh !== false,
                        useBuiltins: true,
                    },
                    optimizer: isEnvProduction
                        ? {
                            simplify: true,
                            jsonify: { minCost: 1024 },
                        }
                        : undefined,
                },
                assumptions: {
                    privateFieldsAsProperties: true,
                    setPublicClassFields: true,
                },
                experimental: { plugins },
            },
            sourceMaps: !config.disableSourceMapGeneration,
        }, { configType, isSsr });
        if (config.bundler === 'rspack') {
            const rspackSwcConfig = swcConfig;
            if (!isSsr && isEnvProduction) {
                rspackSwcConfig.rspackExperiments = {
                    import: [
                        {
                            libraryName: 'lodash',
                            customName: 'lodash/{{member}}',
                        },
                    ],
                };
            }
            return {
                loader: 'builtin:swc-loader',
                options: rspackSwcConfig,
            };
        }
        return {
            loader: require.resolve('swc-loader'),
            options: swcConfig,
        };
    }
    const plugins = [];
    if (!isSsr) {
        if (isEnvDevelopment && config.reactRefresh !== false) {
            plugins.push([
                require.resolve('react-refresh/babel'),
                config.devServer?.webSocketPath
                    ? {
                        overlay: {
                            sockPath: config.devServer.webSocketPath,
                        },
                    }
                    : undefined,
            ]);
        }
        if (isEnvProduction) {
            plugins.push([
                require.resolve('babel-plugin-import'),
                { libraryName: 'lodash', libraryDirectory: '', camel2DashComponentName: false },
            ]);
        }
    }
    const babelTransformOptions = await config.babel({
        presets: [(0, babel_1.babelPreset)({ newJsxTransform: config.newJsxTransform, isSsr })],
        plugins,
    }, { configType, isSsr });
    return {
        loader: require.resolve('babel-loader'),
        options: {
            sourceType: 'unambiguous',
            ...babelTransformOptions,
            babelrc: false,
            configFile: false,
            compact: isEnvProduction,
            sourceMaps: !config.disableSourceMapGeneration,
            cacheCompression: isEnvProduction,
            cacheDirectory: config.babelCacheDirectory ? config.babelCacheDirectory : true,
        },
    };
}
function createJavaScriptRule({ config, isEnvProduction }, jsLoader) {
    const include = [
        paths_1.default.appClient,
        ...(config.monaco && isEnvProduction
            ? [path.resolve(paths_1.default.appNodeModules, 'monaco-editor/esm/vs')]
            : []),
        ...(config.includes || []),
    ];
    return {
        test: [/\.[jt]sx?$/, /\.[cm]js$/],
        include,
        use: jsLoader,
    };
}
function createSourceMapRules(shouldUseSourceMap) {
    if (shouldUseSourceMap) {
        return [
            {
                test: [/\.jsx?$/, /\.[cm]js$/],
                enforce: 'pre',
                include: /node_modules/,
                use: require.resolve('source-map-loader'),
            },
        ];
    }
    return [];
}
async function createWorkerRule(options) {
    return {
        test: /\.worker\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
            options.config.newWebWorkerSyntax
                ? {
                    loader: require.resolve('./worker/worker-loader'),
                }
                : {
                    loader: require.resolve('worker-rspack-loader'),
                    // currently workers located on cdn are not working properly, so we are enforcing loading workers from
                    // service instead
                    options: {
                        inline: 'no-fallback',
                    },
                },
            await createJavaScriptLoader(options),
        ],
    };
}
function createSassStylesRule(options) {
    const loaders = getCssLoaders(options, [
        {
            loader: require.resolve('resolve-url-loader'),
            options: {
                sourceMap: !options.config.disableSourceMapGeneration,
            },
        },
        {
            loader: require.resolve('sass-loader'),
            options: {
                sourceMap: true, // must be always true for work with resolve-url-loader
                sassOptions: {
                    loadPaths: [paths_1.default.appClient],
                },
            },
        },
    ]);
    return {
        test: /\.scss$/,
        sideEffects: options.isEnvProduction ? true : undefined,
        use: loaders,
    };
}
function createStylesRule(options) {
    const loaders = getCssLoaders(options);
    return {
        test: /\.css$/,
        sideEffects: options.isEnvProduction ? true : undefined,
        use: loaders,
    };
}
function getCssLoaders({ isEnvDevelopment, isEnvProduction, config, isSsr }, additionalRules) {
    const isRspack = config.bundler === 'rspack';
    const loaders = [];
    if (!config.transformCssWithLightningCss) {
        loaders.push({
            loader: require.resolve('postcss-loader'),
            options: {
                sourceMap: !config.disableSourceMapGeneration,
                postcssOptions: {
                    config: false,
                    plugins: [
                        [require.resolve('postcss-preset-env'), { enableClientSidePolyfills: false }],
                    ],
                },
            },
        });
    }
    if (Array.isArray(additionalRules) && additionalRules.length > 0) {
        loaders.push(...additionalRules);
    }
    const importLoaders = loaders.length;
    loaders.unshift({
        loader: require.resolve('css-loader'),
        options: {
            url: {
                filter: (url) => {
                    // ignore data uri
                    return !url.startsWith('data:');
                },
            },
            sourceMap: !config.disableSourceMapGeneration,
            importLoaders,
            modules: {
                auto: true,
                localIdentName: '[name]__[local]--[hash:base64:5]',
                exportLocalsConvention: 'camelCase',
                exportOnlyLocals: isSsr,
            },
        },
    });
    if (isEnvProduction) {
        loaders.unshift({
            loader: isRspack ? core_1.rspack.CssExtractRspackPlugin.loader : mini_css_extract_plugin_1.default.loader,
            options: { emit: !isSsr },
        });
    }
    if (isEnvDevelopment) {
        if (isSsr || config.ssr) {
            loaders.unshift({
                loader: isRspack
                    ? core_1.rspack.CssExtractRspackPlugin.loader
                    : mini_css_extract_plugin_1.default.loader,
                options: { emit: !isSsr },
            });
        }
        else {
            loaders.unshift({
                loader: require.resolve('style-loader'),
            });
        }
    }
    return loaders;
}
function createIconsRule({ isEnvProduction, config, isSsr }, jsLoader) {
    const iconIncludes = config.icons || [];
    return {
        // eslint-disable-next-line security/detect-unsafe-regex
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        // we can't use one rule with issuer: /\.[jt]sx?$/ cause of https://github.com/webpack/webpack/issues/9309
        issuer: jsLoader ? undefined : /\.s?css$/,
        include: [
            /icons\/.*\.svg$/,
            // eslint-disable-next-line security/detect-non-literal-regexp
            ...iconIncludes.map((dir) => new RegExp(dir)),
        ],
        ...(jsLoader
            ? {
                use: [
                    jsLoader,
                    {
                        loader: require.resolve('@svgr/webpack'),
                        options: {
                            babel: false,
                            dimensions: false,
                            jsxRuntime: config.newJsxTransform ? 'automatic' : 'classic',
                            ...config.svgr,
                        },
                    },
                ],
            }
            : {
                type: 'asset',
                parser: {
                    dataUrlCondition: {
                        maxSize: imagesSizeLimit,
                    },
                },
                generator: {
                    filename: 'assets/images/[name].[contenthash:8][ext]',
                    publicPath: isEnvProduction ? '../' : undefined,
                    emit: !isSsr,
                },
            }),
    };
}
function createAssetsRules({ isEnvProduction, config, isSsr }) {
    const imagesRule = {
        test: /\.(ico|bmp|gif|jpe?g|png|svg)$/,
        include: [paths_1.default.appClient, ...(config.images || [])],
        type: 'asset',
        parser: {
            dataUrlCondition: {
                maxSize: imagesSizeLimit,
            },
        },
        generator: {
            filename: 'assets/images/[name].[contenthash:8][ext]',
            emit: !isSsr,
        },
    };
    const fontsRule = {
        test: /\.(ttf|eot|woff2?)$/,
        include: [paths_1.default.appClient],
        type: 'asset',
        parser: {
            dataUrlCondition: {
                maxSize: fontSizeLimit,
            },
        },
        generator: {
            filename: 'assets/fonts/[name].[contenthash:8][ext]',
            emit: !isSsr,
        },
    };
    const rules = [imagesRule, fontsRule];
    if (isEnvProduction) {
        // with dynamic public path, imports from css files will look for assets in 'css/assets' directory
        // we are enforcing loading them from 'assets'
        rules.unshift({
            test: /\.(ico|bmp|gif|jpe?g|png|svg)$/,
            issuer: /\.s?css$/,
            include: [paths_1.default.appClient, ...(config.images || [])],
            type: 'asset',
            parser: {
                dataUrlCondition: {
                    maxSize: imagesSizeLimit,
                },
            },
            generator: {
                filename: 'assets/images/[name].[contenthash:8][ext]',
                publicPath: '../',
                emit: !isSsr,
            },
        }, {
            test: /\.(ttf|eot|woff2?)$/,
            issuer: /\.s?css$/,
            include: [paths_1.default.appClient],
            type: 'asset',
            parser: {
                dataUrlCondition: {
                    maxSize: fontSizeLimit,
                },
            },
            generator: {
                filename: 'assets/fonts/[name].[contenthash:8][ext]',
                publicPath: '../',
                emit: !isSsr,
            },
        });
    }
    return rules;
}
function createFallbackRules({ isEnvProduction, isSsr }) {
    const rules = [
        {
            type: 'asset/resource',
            generator: {
                filename: 'assets/[name].[contenthash:8][ext]',
                emit: !isSsr,
            },
            exclude: [/\.[jt]sx?$/, /\.json$/, /\.[cm]js$/, /\.ejs$/],
        },
    ];
    if (isEnvProduction) {
        // with dynamic public path, imports from css files will look for assets in 'css/assets' directory
        // we are enforcing loading them from 'assets'
        rules.unshift({
            test: /\.(ttf|eot|woff2?|bmp|gif|jpe?g|png|svg)$/,
            issuer: /\.s?css$/,
            type: 'asset/resource',
            generator: {
                filename: 'assets/[name].[contenthash:8][ext]',
                publicPath: '../',
                emit: !isSsr,
            },
        });
    }
    return rules;
}
function createMomentTimezoneDataPlugin(options = {}) {
    const currentYear = new Date().getFullYear();
    // By default get data for current year only
    // https://momentjs.com/timezone/docs/#/use-it/webpack/
    const startYear = options.startYear ?? currentYear;
    const endYear = options.endYear ?? currentYear;
    return new moment_timezone_data_webpack_plugin_1.default({ ...options, startYear, endYear });
}
function getDefinitions({ config, isSsr }) {
    return {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        'process.env.IS_SSR': JSON.stringify(isSsr),
        ...config.definitions,
    };
}
function getContextReplacements({ config, isSsr }) {
    const contextReplacement = config.contextReplacement || {};
    if (isSsr) {
        return [];
    }
    const replacements = [
        {
            resourceRegExp: /moment[\\/]locale$/, // eslint-disable-next-line security/detect-non-literal-regexp
            newResource: new RegExp(`^\\./(${(contextReplacement.locale || ['ru']).join('|')})$`),
        },
        {
            resourceRegExp: /dayjs[\\/]locale$/,
            // eslint-disable-next-line security/detect-non-literal-regexp
            newResource: new RegExp(`^\\./(${(contextReplacement.locale || ['ru']).join('|')})\\.js$`),
        },
    ];
    if (contextReplacement['highlight.js']) {
        replacements.push({
            resourceRegExp: /highlight\.js[\\/]lib[\\/]languages$/,
            // eslint-disable-next-line security/detect-non-literal-regexp
            newResource: new RegExp(`^\\./(${contextReplacement['highlight.js'].join('|')})$`),
        });
    }
    return replacements;
}
function getForkTsCheckerOptions({ config, }) {
    return config.forkTsChecker === false
        ? undefined
        : {
            ...config.forkTsChecker,
            typescript: {
                typescriptPath: (0, utils_2.resolveTypescript)(),
                configFile: path.resolve(paths_1.default.appClient, 'tsconfig.json'),
                diagnosticOptions: {
                    syntactic: true,
                },
                mode: 'write-references',
                ...config.forkTsChecker?.typescript,
            },
        };
}
function getCssExtractPluginOptions({ isEnvProduction }) {
    return {
        filename: isEnvProduction ? 'css/[name].[contenthash:8].css' : 'css/[name].css',
        chunkFilename: isEnvProduction
            ? 'css/[name].[contenthash:8].chunk.css'
            : 'css/[name].chunk.css',
        ignoreOrder: true,
    };
}
function configureCommonPlugins(options, bundlerPlugins) {
    const { isEnvDevelopment, isEnvProduction, config, isSsr } = options;
    const excludeFromClean = config.excludeFromClean || [];
    const forkTsCheckerOptions = getForkTsCheckerOptions(options);
    const plugins = [
        new clean_webpack_plugin_1.CleanWebpackPlugin({
            verbose: config.verbose,
            cleanOnceBeforeBuildPatterns: [
                '**/*',
                ...(isEnvDevelopment ? ['!manifest.json'] : []),
                ...excludeFromClean,
            ],
        }),
        new bundlerPlugins.ManifestPlugin({
            writeToFileEmit: true,
            publicPath: '',
        }),
        new bundlerPlugins.DefinePlugin(getDefinitions(options)),
        ...(options.logger ? [new bundlerPlugins.ProgressPlugin({ logger: options.logger })] : []),
        ...(forkTsCheckerOptions ? [new bundlerPlugins.TsCheckerPlugin(forkTsCheckerOptions)] : []),
    ];
    if (config.detectCircularDependencies) {
        let circularPluginOptions = {
            exclude: /node_modules/,
            allowAsyncCycles: true,
        };
        if (typeof config.detectCircularDependencies === 'object') {
            circularPluginOptions = config.detectCircularDependencies;
        }
        plugins.push(new circular_dependency_plugin_1.default(circularPluginOptions));
    }
    if (isEnvProduction || isSsr || config.ssr) {
        plugins.push(new bundlerPlugins.CSSExtractPlugin(getCssExtractPluginOptions(options)));
    }
    if (!isSsr) {
        const contextReplacements = getContextReplacements(options);
        contextReplacements.forEach(({ resourceRegExp, newResource }) => plugins.push(new bundlerPlugins.ContextReplacementPlugin(resourceRegExp, newResource)));
        if (config.polyfill?.process) {
            plugins.push(new bundlerPlugins.ProvidePlugin({
                process: 'process/browser.js',
            }));
        }
        if (config.monaco) {
            const MonacoEditorWebpackPlugin = require('monaco-editor-webpack-plugin');
            plugins.push(new MonacoEditorWebpackPlugin({
                filename: isEnvProduction ? '[name].[hash:8].worker.js' : undefined,
                ...config.monaco,
                // currently, workers located on cdn are not working properly, so we are enforcing loading workers from
                // service instead
                publicPath: path.normalize(config.publicPathPrefix + '/build/'),
            }));
        }
        plugins.push(createMomentTimezoneDataPlugin(config.momentTz));
    }
    if (isEnvProduction) {
        if (config.analyzeBundle === 'true') {
            plugins.push(new webpack_bundle_analyzer_1.BundleAnalyzerPlugin({
                openAnalyzer: false,
                analyzerMode: 'static',
                reportFilename: 'stats.html',
            }));
        }
        if (config.analyzeBundle === 'statoscope') {
            const customStatoscopeConfig = config.statoscopeConfig || {};
            const statoscopePlugin = new webpack_plugin_1.default({
                saveReportTo: path.resolve(options.buildDirectory, 'report.html'),
                saveStatsTo: path.resolve(options.buildDirectory, 'stats.json'),
                open: false,
                statsOptions: {
                    all: true,
                },
                ...customStatoscopeConfig,
            });
            // TIP: statoscope doesn't support rspack, but this workaround helps to run it
            if (config.bundler === 'rspack') {
                const compressor = statoscopePlugin.options.compressor;
                statoscopePlugin.extensions =
                    compressor === false ? [] : [new statoscope_1.RspackCompressedExtension(compressor)];
            }
            plugins.push(statoscopePlugin);
        }
        if (config.analyzeBundle === 'rsdoctor') {
            plugins.push(new bundlerPlugins.RSDoctorPlugin({
                mode: 'brief',
            }));
        }
        if (config.sentryConfig) {
            const sentryPlugin = require('@sentry/webpack-plugin').sentryWebpackPlugin;
            plugins.push(sentryPlugin({ ...config.sentryConfig }));
        }
    }
    if (config.cdn) {
        plugins.push(...(0, s3_upload_1.createS3UploadPlugins)(config, options.logger));
    }
    return plugins;
}
function configureWebpackPlugins(options) {
    const { isEnvDevelopment, isEnvProduction, config, isSsr } = options;
    const plugins = {
        DefinePlugin: webpack.DefinePlugin,
        ContextReplacementPlugin: webpack.ContextReplacementPlugin,
        ProvidePlugin: webpack.ProvidePlugin,
        ProgressPlugin: (0, progress_plugin_1.createProgressPlugin)(webpack.ProgressPlugin),
        ManifestPlugin: webpack_manifest_plugin_1.WebpackManifestPlugin,
        TsCheckerPlugin: fork_ts_checker_webpack_plugin_1.default,
        CSSExtractPlugin: mini_css_extract_plugin_1.default,
        RSDoctorPlugin: require('@rsdoctor/webpack-plugin').RsdoctorWebpackPlugin,
    };
    const webpackPlugins = [
        ...configureCommonPlugins(options, plugins),
        new webpack_assets_manifest_1.default(isEnvProduction
            ? {
                entrypoints: true,
                output: assetsManifestFile,
            }
            : {
                entrypoints: true,
                writeToDisk: true,
                output: path.resolve(options.buildDirectory, assetsManifestFile),
            }),
        ...(process.env.WEBPACK_PROFILE === 'true' ? [new webpack.debug.ProfilingPlugin()] : []),
    ];
    if (!isSsr && isEnvDevelopment && config.reactRefresh !== false) {
        const { webSocketPath = path.normalize(`/${config.publicPathPrefix}/build/sockjs-node`) } = config.devServer || {};
        const reactRefreshConfig = config.reactRefresh({
            overlay: { sockPath: webSocketPath },
            exclude: [/node_modules/, /\.worker\.[jt]sx?$/],
        });
        webpackPlugins.push(new react_refresh_webpack_plugin_1.default(reactRefreshConfig));
    }
    return webpackPlugins;
}
function configureRspackPlugins(options) {
    const { isEnvDevelopment, isEnvProduction, config, isSsr } = options;
    const plugins = {
        DefinePlugin: core_1.rspack.DefinePlugin,
        ContextReplacementPlugin: core_1.rspack.ContextReplacementPlugin,
        ProvidePlugin: core_1.rspack.ProvidePlugin,
        ProgressPlugin: (0, progress_plugin_1.createProgressPlugin)(core_1.rspack.ProgressPlugin),
        ManifestPlugin: rspack_manifest_plugin_1.RspackManifestPlugin,
        TsCheckerPlugin: ts_checker_rspack_plugin_1.TsCheckerRspackPlugin,
        CSSExtractPlugin: core_1.rspack.CssExtractRspackPlugin,
        RSDoctorPlugin: require('@rsdoctor/rspack-plugin').RsdoctorRspackPlugin,
    };
    const rspackPlugins = [
        ...configureCommonPlugins(options, plugins),
        new rspack_manifest_plugin_1.RspackManifestPlugin({
            fileName: isEnvProduction
                ? assetsManifestFile
                : path.resolve(options.buildDirectory, assetsManifestFile),
            writeToFileEmit: true,
            useLegacyEmit: true,
            publicPath: '',
            generate: rspack_1.generateAssetsManifest,
        }),
    ];
    if (!isSsr && isEnvDevelopment && config.reactRefresh !== false) {
        const { webSocketPath = path.normalize(`/${config.publicPathPrefix}/build/sockjs-node`) } = config.devServer || {};
        const { overlay, ...reactRefreshConfig } = config.reactRefresh({
            overlay: { sockPath: webSocketPath },
            exclude: [/node_modules/, /\.worker\.[jt]sx?$/],
        });
        rspackPlugins.push(new plugin_react_refresh_1.default({
            ...reactRefreshConfig,
            overlay: typeof overlay === 'object'
                ? {
                    entry: typeof overlay.entry === 'string' ? overlay.entry : undefined,
                    module: typeof overlay.module === 'string' ? overlay.module : undefined,
                    sockPath: overlay.sockPath,
                    sockHost: overlay.sockHost,
                    sockPort: overlay.sockPort?.toString(),
                    sockProtocol: overlay.sockProtocol,
                    sockIntegration: overlay.sockIntegration === 'wds' ? 'wds' : undefined,
                }
                : undefined,
        }));
    }
    return rspackPlugins;
}
function getOptimizationSplitChunks({ config }) {
    const configVendors = config.vendors ?? [];
    let vendorsList = [
        'react',
        'react-dom',
        'prop-types',
        'redux',
        'react-redux',
        '@reduxjs/toolkit',
        'lodash',
        'lodash-es',
        'moment',
        'bem-cn-lite',
        'axios',
    ];
    if (typeof configVendors === 'function') {
        vendorsList = configVendors(vendorsList);
    }
    else if (Array.isArray(configVendors)) {
        vendorsList = vendorsList.concat(configVendors);
    }
    const useVendorsList = vendorsList.length > 0;
    return {
        chunks: 'all',
        cacheGroups: {
            ...(useVendorsList
                ? {
                    defaultVendors: {
                        name: 'vendors',
                        // eslint-disable-next-line security/detect-non-literal-regexp
                        test: new RegExp(`([\\\\/])node_modules\\1(${vendorsList.join('|')})\\1`),
                        priority: Infinity,
                    },
                }
                : undefined),
            css: {
                type: 'css/mini-extract',
                enforce: true,
                minChunks: 2,
                reuseExistingChunk: true,
            },
        },
    };
}
function configureOptimization(helperOptions) {
    const { config, isSsr } = helperOptions;
    if (isSsr) {
        return {};
    }
    const optimization = {
        splitChunks: getOptimizationSplitChunks(helperOptions),
        runtimeChunk: 'single',
        minimizer: [
            (compiler) => {
                // CssMinimizerWebpackPlugin works with MiniCSSExtractPlugin, so only relevant for production builds.
                // Lazy load the CssMinimizerPlugin plugin
                const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
                if (config.transformCssWithLightningCss) {
                    const lightningCss = require('lightningcss');
                    const browserslist = require('browserslist');
                    new CssMinimizerPlugin({
                        minify: CssMinimizerPlugin.lightningCssMinify,
                        minimizerOptions: {
                            targets: lightningCss.browserslistToTargets(browserslist()),
                        },
                    }).apply(compiler);
                }
                else {
                    new CssMinimizerPlugin({
                        minimizerOptions: {
                            preset: [
                                'default',
                                {
                                    svgo: false,
                                },
                            ],
                        },
                    }).apply(compiler);
                }
            },
            (compiler) => {
                // Lazy load the Terser plugin
                const TerserPlugin = require('terser-webpack-plugin');
                let terserOptions = {
                    compress: {
                        passes: 2,
                    },
                    safari10: config.safari10,
                    mangle: !config.reactProfiling,
                };
                const { terser } = config;
                if (typeof terser === 'function') {
                    terserOptions = terser(terserOptions);
                }
                new TerserPlugin({
                    minify: config.javaScriptLoader === 'swc'
                        ? TerserPlugin.swcMinify
                        : TerserPlugin.terserMinify,
                    terserOptions,
                }).apply(compiler);
            },
        ],
    };
    return optimization;
}
function configureRspackOptimization(helperOptions) {
    const { config, isSsr } = helperOptions;
    if (isSsr) {
        return {};
    }
    let cssMinimizer;
    if (config.transformCssWithLightningCss) {
        cssMinimizer = new core_1.rspack.LightningCssMinimizerRspackPlugin({
            minimizerOptions: {
                // Plugin will read the browserslist itself and generate targets
                targets: [],
            },
        });
    }
    else {
        const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
        cssMinimizer = new CssMinimizerPlugin({
            minimizerOptions: {
                preset: [
                    'default',
                    {
                        svgo: false,
                    },
                ],
            },
        });
    }
    let swcMinifyOptions = {
        minimizerOptions: {
            mangle: !config.reactProfiling,
            compress: {
                passes: 2,
            },
            format: {
                safari10: config.safari10,
            },
        },
    };
    const { swcMinimizerOptions } = config;
    if (typeof swcMinimizerOptions === 'function') {
        swcMinifyOptions = swcMinimizerOptions(swcMinifyOptions);
    }
    const optimization = {
        splitChunks: getOptimizationSplitChunks(helperOptions),
        runtimeChunk: 'single',
        minimizer: [new core_1.rspack.SwcJsMinimizerRspackPlugin(swcMinifyOptions), cssMinimizer],
    };
    return optimization;
}
