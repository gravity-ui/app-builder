/* eslint-disable complexity */
import path, {resolve} from 'path';
import fs from 'fs';
import * as webpack from 'webpack';
import _ from 'lodash';
import {CleanWebpackPlugin} from 'clean-webpack-plugin';
import {WebpackManifestPlugin} from 'webpack-manifest-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import MiniCSSExtractPlugin from 'mini-css-extract-plugin';
import OptimizeCSSAssetsPlugin from 'css-minimizer-webpack-plugin';
import {BundleAnalyzerPlugin} from 'webpack-bundle-analyzer';
import postcssPresetEnv from 'postcss-preset-env';
import WebpackAssetsManifest from 'webpack-assets-manifest';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import MomentTimezoneDataPlugin from 'moment-timezone-data-webpack-plugin';
import StatoscopeWebpackPlugin from '@statoscope/webpack-plugin';
import CircularDependencyPlugin from 'circular-dependency-plugin';

import paths from '../paths';
import tempData from '../tempData';
import {babelPreset} from '../babel';
import type {LinkedPackage, NormalizedClientConfig} from '../models';
import type {Logger} from '../logger';
import {ProgressPlugin} from './progress-plugin';
import {resolveTsconfigPathsToAlias} from './utils';
import {S3UploadPlugin} from '../s3-upload';

const imagesSizeLimit = 2048;
const fontSizeLimit = 8192;

export interface HelperOptions {
    config: NormalizedClientConfig;
    logger?: Logger;
    isEnvDevelopment: boolean;
    isEnvProduction: boolean;
    updateIncludes?: (
        values: string[],
        options?: {includeRootAssets?: boolean; includeRootStyles?: boolean},
    ) => string[];
    tsLinkedPackages?: LinkedPackage[];
}

export const enum WebpackMode {
    Prod = 'production',
    Dev = 'development',
}

export function webpackConfigFactory(
    webpackMode: WebpackMode,
    config: NormalizedClientConfig,
    {logger}: {logger?: Logger} = {},
): webpack.Configuration {
    const isEnvDevelopment = webpackMode === WebpackMode.Dev;
    const isEnvProduction = webpackMode === WebpackMode.Prod;

    const {updateIncludes, tsLinkedPackages} = updateIncludesFactory();

    const helperOptions: HelperOptions = {
        config,
        logger,
        isEnvDevelopment,
        isEnvProduction,
        updateIncludes,
        tsLinkedPackages,
    };

    return {
        mode: webpackMode,
        context: paths.app,
        bail: isEnvProduction,
        devtool: configureDevTool(helperOptions),
        entry: configureEntry(helperOptions),
        output: configureOutput(helperOptions),
        resolve: configureResolve(helperOptions),
        module: {
            rules: configureModuleRules(helperOptions),
        },
        plugins: configurePlugins(helperOptions),
        optimization: configureOptimization(helperOptions),
        externals: config.externals,
        node: config.node,
        watchOptions: configureWatchOptions(helperOptions),
        ignoreWarnings: [/Failed to parse source map/],
        infrastructureLogging: config.verbose
            ? {
                  colors: true,
                  level: 'verbose',
              }
            : undefined,

        experiments: isEnvDevelopment ? configureExperiments(helperOptions) : undefined,
        snapshot: {
            managedPaths: config.watchOptions?.watchPackages ? [] : undefined,
        },
    };
}

export function configureModuleRules(helperOptions: HelperOptions) {
    const jsLoader = createJavaScriptLoader(helperOptions);
    return [
        ...createSourceMapRules(!helperOptions.config.disableSourceMapGeneration),
        {
            oneOf: [
                createWorkerRule(helperOptions),
                createJavaScriptRule(helperOptions, jsLoader),
                createStylesRule(helperOptions),
                createIconsRule(helperOptions), // workaround for https://github.com/webpack/webpack/issues/9309
                createIconsRule(helperOptions, jsLoader),
                ...createAssetsRules(helperOptions),
                ...createFallbackRules(helperOptions),
            ],
        },
    ];
}

function updateIncludesFactory() {
    const {linkedPackages} = tempData.getSettings();
    const linkedPackagesArr = linkedPackages
        ? linkedPackages.keys.map((key) => linkedPackages.data[key]!)
        : [];

    if (linkedPackagesArr.length === 0) {
        return {};
    }

    const tsLinkedPackages = linkedPackagesArr.filter(({typescript}) => typescript);
    const linkedPackagesJsIncludes = linkedPackagesArr.map((data) => `${data.package}/src`);
    const linkedPackagesRootAssetsIncludes = linkedPackagesArr.map(
        (data) => `${data.package}/assets`,
    );
    const linkedPackagesRootStylesIncludes = linkedPackagesArr.map(
        (data) => `${data.package}/styles`,
    );

    return {
        updateIncludes: (
            includes: string[],
            options?: {includeRootAssets?: boolean; includeRootStyles?: boolean},
        ) => {
            let result = includes.filter((pathname) =>
                _.every(
                    linkedPackagesArr,
                    (linkedPackage) =>
                        // eslint-disable-next-line security/detect-non-literal-regexp
                        !new RegExp(linkedPackage.name).test(pathname),
                ),
            );

            result = [...result, ...linkedPackagesJsIncludes];

            if (options?.includeRootAssets) {
                result = [...result, ...linkedPackagesRootAssetsIncludes];
            }

            if (options?.includeRootStyles) {
                result = [...result, ...linkedPackagesRootStylesIncludes];
            }

            return result;
        },
        tsLinkedPackages,
    };
}

function configureDevTool({isEnvProduction, config}: HelperOptions) {
    let format: webpack.Configuration['devtool'] = 'cheap-module-source-map';
    if (isEnvProduction) {
        format = config.hiddenSourceMap ? 'hidden-source-map' : 'source-map';
    }

    return config.disableSourceMapGeneration ? false : format;
}

function configureWatchOptions({config}: HelperOptions): webpack.Configuration['watchOptions'] {
    const watchOptions = {
        ...config.watchOptions,
        followSymlinks:
            config.watchOptions?.followSymlinks ??
            (!config.symlinks && config.watchOptions?.watchPackages)
                ? true
                : undefined,
    };

    delete watchOptions.watchPackages;

    return watchOptions;
}

function configureExperiments({config}: HelperOptions): webpack.Configuration['experiments'] {
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

export function configureResolve({
    isEnvProduction,
    config,
    tsLinkedPackages,
}: HelperOptions): webpack.ResolveOptions {
    let alias: Record<string, string> = config.alias || {};

    alias = Object.entries(alias).reduce<Record<string, string>>((result, [key, value]) => {
        result[key] = path.resolve(paths.app, value);
        return result;
    }, {});

    if (isEnvProduction && config.reactProfiling) {
        alias['react-dom$'] = 'react-dom/profiling';
        alias['scheduler/tracing'] = 'scheduler/tracing-profiling';
    }

    if (tsLinkedPackages) {
        tsLinkedPackages.forEach(({name}) => {
            alias[`${name}$`] = `${name}/src`;
        });
    }

    const {aliases, modules = []} =
        resolveTsconfigPathsToAlias(path.resolve(paths.appClient, 'tsconfig.json')) || {};
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

function createEntryArray(entry: string) {
    return [require.resolve('./public-path'), entry];
}

function addEntry(entry: webpack.EntryObject, file: string): webpack.EntryObject {
    const newEntry = path.resolve(paths.appEntry, file);
    return {
        ...entry,
        [path.parse(file).name]: createEntryArray(newEntry),
    };
}

function configureEntry({config}: HelperOptions): webpack.EntryObject {
    let entries = fs.readdirSync(paths.appEntry).filter((file) => /\.[jt]sx?$/.test(file));

    if (Array.isArray(config.entryFilter) && config.entryFilter.length) {
        entries = entries.filter((entry) =>
            config.entryFilter?.includes(entry.split('.')[0] ?? ''),
        );
    }

    if (!entries.length) {
        throw new Error('No entries were found after applying UI_CORE_ENTRY_FILTER');
    }

    return entries.reduce((entry, file) => addEntry(entry, file), {});
}

function getFileNames({isEnvProduction}: HelperOptions) {
    return {
        filename: isEnvProduction ? 'js/[name].[contenthash:8].js' : 'js/[name].js',
        chunkFilename: isEnvProduction
            ? 'js/[name].[contenthash:8].chunk.js'
            : 'js/[name].chunk.js',
    };
}

function configureOutput({
    isEnvDevelopment,
    ...rest
}: HelperOptions): webpack.Configuration['output'] {
    return {
        ...getFileNames({isEnvDevelopment, ...rest}),
        path: paths.appBuild,
        pathinfo: isEnvDevelopment,
    };
}

function createJavaScriptLoader({
    isEnvProduction,
    isEnvDevelopment,
    config,
}: HelperOptions): webpack.RuleSetUseItem {
    return {
        loader: require.resolve('babel-loader'),
        options: {
            babelrc: false,
            configFile: false,
            presets: [babelPreset(config)],
            plugins: [
                isEnvDevelopment &&
                    !config.disableReactRefresh && [
                        require.resolve('react-refresh/babel'),
                        config.devServer?.webSocketPath
                            ? {
                                  overlay: {
                                      sockPath: config.devServer.webSocketPath,
                                  },
                              }
                            : undefined,
                    ],
                isEnvProduction && require.resolve('babel-plugin-lodash'),
            ].filter(Boolean),
            sourceType: 'unambiguous',
            cacheDirectory: true,
            cacheCompression: isEnvProduction,
            compact: isEnvProduction,
            sourceMap: !config.disableSourceMapGeneration,
        },
    };
}

function createJavaScriptRule(
    {updateIncludes = _.identity, config, isEnvProduction}: HelperOptions,
    jsLoader: webpack.RuleSetUseItem,
): webpack.RuleSetRule {
    const include = updateIncludes([
        paths.appClient,
        ...(config.monaco && isEnvProduction
            ? [path.resolve(paths.appNodeModules, 'monaco-editor/esm/vs')]
            : []),
        ...(config.includes || []),
    ]);

    return {
        test: [/\.[jt]sx?$/, /\.[cm]js$/],
        include,
        use: jsLoader,
    };
}

function createSourceMapRules(shouldUseSourceMap: boolean): webpack.RuleSetRule[] {
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

function createWorkerRule(options: HelperOptions): webpack.RuleSetRule {
    return {
        test: /\.worker\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
            options.config.newWebWorkerSyntax
                ? {
                      loader: require.resolve('./worker/worker-loader'),
                  }
                : {
                      loader: require.resolve('worker-loader'),
                      // currently workers located on cdn are not working properly, so we are enforcing loading workers from
                      // service instead
                      options: {
                          inline: 'no-fallback',
                      },
                  },
            createJavaScriptLoader(options),
        ],
    };
}

function createStylesRule({
    isEnvDevelopment,
    isEnvProduction,
    config,
}: HelperOptions): webpack.RuleSetRule {
    const loaders: webpack.RuleSetUseItem[] = [];

    if (isEnvProduction) {
        loaders.push(MiniCSSExtractPlugin.loader);
    }

    if (isEnvDevelopment) {
        loaders.push({
            loader: require.resolve('style-loader'),
        });
    }

    loaders.push({
        loader: require.resolve('css-loader'),
        options: {
            esModule: false,
            sourceMap: !config.disableSourceMapGeneration,
            importLoaders: 2,
        },
    });

    loaders.push({
        loader: require.resolve('postcss-loader'),
        options: {
            sourceMap: !config.disableSourceMapGeneration,
            postcssOptions: {
                config: false,
                plugins: [postcssPresetEnv({enableClientSidePolyfills: false})],
            },
        },
    });

    loaders.push({
        loader: require.resolve('resolve-url-loader'),
        options: {
            sourceMap: !config.disableSourceMapGeneration,
        },
    });

    loaders.push({
        loader: require.resolve('sass-loader'),
        options: {
            sourceMap: true, // must be always true for work with resolve-url-loader
            sassOptions: {
                includePaths: [paths.appClient],
            },
        },
    });

    return {
        test: /\.s?css$/,
        sideEffects: isEnvProduction ? true : undefined,
        use: loaders,
    };
}

function createIconsRule(
    {isEnvProduction, config}: HelperOptions,
    jsLoader?: webpack.RuleSetUseItem,
): webpack.RuleSetRule {
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
                  },
              }),
    };
}

function createAssetsRules({
    updateIncludes = _.identity,
    isEnvProduction,
    config,
}: HelperOptions): webpack.RuleSetRule[] {
    const imagesRule = {
        test: /\.(ico|bmp|gif|jpe?g|png|svg)$/,
        include: updateIncludes([paths.appClient, ...(config.images || [])], {
            includeRootAssets: true,
        }),
        type: 'asset',
        parser: {
            dataUrlCondition: {
                maxSize: imagesSizeLimit,
            },
        },
        generator: {
            filename: 'assets/images/[name].[contenthash:8][ext]',
        },
    };
    const fontsRule = {
        test: /\.(ttf|eot|woff2?)$/,
        include: [paths.appClient],
        type: 'asset',
        parser: {
            dataUrlCondition: {
                maxSize: fontSizeLimit,
            },
        },
        generator: {
            filename: 'assets/fonts/[name].[contenthash:8][ext]',
        },
    };

    const rules: webpack.RuleSetRule[] = [imagesRule, fontsRule];

    if (isEnvProduction) {
        // with dynamic public path, imports from css files will look for assets in 'css/assets' directory
        // we are enforcing loading them from 'assets'
        rules.unshift(
            {
                test: /\.(ico|bmp|gif|jpe?g|png|svg)$/,
                issuer: /\.s?css$/,
                include: updateIncludes([paths.appClient, ...(config.images || [])], {
                    includeRootAssets: true,
                }),
                type: 'asset',
                parser: {
                    dataUrlCondition: {
                        maxSize: imagesSizeLimit,
                    },
                },
                generator: {
                    filename: 'assets/images/[name].[contenthash:8][ext]',
                    publicPath: '../',
                },
            },
            {
                test: /\.(ttf|eot|woff2?)$/,
                issuer: /\.s?css$/,
                include: [paths.appClient],
                type: 'asset',
                parser: {
                    dataUrlCondition: {
                        maxSize: fontSizeLimit,
                    },
                },
                generator: {
                    filename: 'assets/fonts/[name].[contenthash:8][ext]',
                    publicPath: '../',
                },
            },
        );
    }

    return rules;
}

function createFallbackRules({isEnvProduction}: HelperOptions) {
    const rules: webpack.RuleSetRule[] = [
        {
            type: 'asset/resource',
            generator: {
                filename: 'assets/[name].[contenthash:8][ext]',
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
            },
        });
    }

    return rules;
}

function createMomentTimezoneDataPlugin(options: NormalizedClientConfig['momentTz'] = {}) {
    const currentYear = new Date().getFullYear();
    // By default get data for current year only
    // https://momentjs.com/timezone/docs/#/use-it/webpack/
    const startYear = options.startYear ?? currentYear;
    const endYear = options.endYear ?? currentYear;

    return new MomentTimezoneDataPlugin({...options, startYear, endYear});
}

function configurePlugins(options: HelperOptions): webpack.Configuration['plugins'] {
    const {isEnvDevelopment, isEnvProduction, config} = options;
    const excludeFromClean = config.excludeFromClean || [];

    const plugins: webpack.Configuration['plugins'] = [
        new CleanWebpackPlugin({
            verbose: config.verbose,
            cleanOnceBeforeBuildPatterns: [
                '**/*',
                ...(isEnvDevelopment ? ['!manifest.json'] : []),
                ...excludeFromClean,
            ],
        }),
        new WebpackManifestPlugin({
            writeToFileEmit: true,
            publicPath: '',
        }),
        createMomentTimezoneDataPlugin(config.momentTz),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            ...config.definitions,
        }),
    ];
    if (options.logger) {
        plugins.push(new ProgressPlugin({logger: options.logger}));
    }
    if (process.env.WEBPACK_PROFILE === 'true') {
        plugins.push(new webpack.debug.ProfilingPlugin());
    }

    const contextReplacement = config.contextReplacement || {};

    plugins.push(
        new webpack.ContextReplacementPlugin(
            /moment[\\/]locale$/,
            // eslint-disable-next-line security/detect-non-literal-regexp
            new RegExp(`^\\./(${(contextReplacement.locale || ['ru']).join('|')})$`),
        ),
    );

    plugins.push(
        new webpack.ContextReplacementPlugin(
            /dayjs[\\/]locale$/,
            // eslint-disable-next-line security/detect-non-literal-regexp
            new RegExp(`^\\./(${(contextReplacement.locale || ['ru']).join('|')})\\.js$`),
        ),
    );

    if (contextReplacement['highlight.js']) {
        plugins.push(
            new webpack.ContextReplacementPlugin(
                /highlight\.js[\\/]lib[\\/]languages$/,
                // eslint-disable-next-line security/detect-non-literal-regexp
                new RegExp(`^\\./(${contextReplacement['highlight.js'].join('|')})$`),
            ),
        );
    }

    if (config.monaco) {
        const MonacoEditorWebpackPlugin = require('monaco-editor-webpack-plugin');
        plugins.push(
            new MonacoEditorWebpackPlugin({
                ...config.monaco,
                // currently, workers located on cdn are not working properly, so we are enforcing loading workers from
                // service instead
                publicPath: path.normalize(config.publicPathPrefix + '/build/'),
            }),
        );
    }

    if (isEnvDevelopment && !config.disableReactRefresh) {
        const {webSocketPath = path.normalize(`/${config.publicPathPrefix}/build/sockjs-node`)} =
            config.devServer || {};
        plugins.push(
            new ReactRefreshWebpackPlugin({
                overlay: {sockPath: webSocketPath},
                exclude: /\.worker\.[jt]sx?$/,
            }),
        );
    }

    if (config.detectCircularDependencies) {
        let circularPluginOptions: CircularDependencyPlugin.Options = {
            exclude: /node_modules/,
            allowAsyncCycles: true,
        };
        if (typeof config.detectCircularDependencies === 'object') {
            circularPluginOptions = config.detectCircularDependencies;
        }
        plugins.push(new CircularDependencyPlugin(circularPluginOptions));
    }

    if (!config.disableForkTsChecker) {
        plugins.push(
            new ForkTsCheckerWebpackPlugin({
                typescript: {
                    typescriptPath: require.resolve(resolve(paths.appNodeModules, 'typescript')),
                    configFile: resolve(paths.app, 'src/ui/tsconfig.json'),
                    diagnosticOptions: {
                        syntactic: true,
                    },
                    mode: 'write-references',
                },
            }),
        );
    }

    if (config.polyfill?.process) {
        plugins.push(new webpack.ProvidePlugin({process: 'process/browser.js'}));
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

        if (config.analyzeBundle === 'true') {
            plugins.push(
                new BundleAnalyzerPlugin({
                    openAnalyzer: false,
                    analyzerMode: 'static',
                    reportFilename: 'stats.html',
                }),
            );
        }

        if (config.analyzeBundle === 'statoscope') {
            plugins.push(
                new StatoscopeWebpackPlugin({
                    saveReportTo: path.resolve(paths.appBuild, 'report.html'),
                    saveStatsTo: path.resolve(paths.appBuild, 'stats.json'),
                    open: false,
                    statsOptions: {
                        all: true,
                    },
                }),
            );
        }
    }

    const manifestFile = 'assets-manifest.json';
    plugins.push(
        new WebpackAssetsManifest(
            isEnvProduction
                ? {
                      entrypoints: true,
                      output: manifestFile,
                  }
                : {
                      entrypoints: true,
                      writeToDisk: true,
                      output: path.resolve(paths.appBuild, manifestFile),
                  },
        ),
    );

    if (config.cdn) {
        let credentialsGlobal;
        if (process.env.FRONTEND_S3_ACCESS_KEY_ID && process.env.FRONTEND_S3_SECRET_ACCESS_KEY) {
            credentialsGlobal = {
                accessKeyId: process.env.FRONTEND_S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.FRONTEND_S3_SECRET_ACCESS_KEY,
            };
        }
        const cdns = Array.isArray(config.cdn) ? config.cdn : [config.cdn];
        for (let index = 0; index < cdns.length; index++) {
            const cdn = cdns[index];
            if (!cdn) {
                continue;
            }
            let credentials = credentialsGlobal;
            const accessKeyId = process.env[`FRONTEND_S3_ACCESS_KEY_ID_${index}`];
            const secretAccessKey = process.env[`FRONTEND_S3_SECRET_ACCESS_KEY_${index}`];
            if (accessKeyId && secretAccessKey) {
                credentials = {
                    accessKeyId,
                    secretAccessKey,
                };
            }
            plugins.push(
                new S3UploadPlugin({
                    exclude: config.hiddenSourceMap ? /\.map$/ : undefined,
                    compress: cdn.compress,
                    s3ClientOptions: {
                        region: cdn.region,
                        endpoint: cdn.endpoint,
                        credentials,
                    },
                    s3UploadOptions: {
                        bucket: cdn.bucket,
                        targetPath: cdn.prefix,
                    },
                    additionalPattern: cdn.additionalPattern,
                }),
            );
        }
    }

    return plugins;
}

function configureOptimization({
    isEnvProduction,
    config,
}: HelperOptions): webpack.Configuration['optimization'] {
    const configVendors = config.vendors ?? [];

    const vendorsList = [
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
        ...configVendors,
    ];

    const optimization: webpack.Configuration['optimization'] = {
        minimize: isEnvProduction && !config.reactProfiling,
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                defaultVendors: {
                    name: 'vendors',
                    // eslint-disable-next-line security/detect-non-literal-regexp
                    test: new RegExp(`([\\\\/])node_modules\\1(${vendorsList.join('|')})\\1`),
                    priority: Infinity,
                },
            },
        },
        runtimeChunk: 'single',
    };

    if (config.safari10) {
        const TerserPlugin = require('terser-webpack-plugin');
        optimization.minimizer = [
            new TerserPlugin({
                terserOptions: {
                    safari10: true,
                },
            }),
        ];
    }

    return optimization;
}
