/* eslint-disable complexity */
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
    Configuration,
    ContextReplacementPlugin,
    CssExtractRspackPlugin,
    EntryObject,
    LazyCompilationOptions,
    ResolveOptions,
    RuleSetRule,
    RuleSetUseItem,
    rspack,
} from '@rspack/core';
import {CleanWebpackPlugin} from 'clean-webpack-plugin';
import _ from 'lodash';
import {BundleAnalyzerPlugin} from 'webpack-bundle-analyzer';
import CircularDependencyPlugin from 'circular-dependency-plugin';
import {ManifestPluginOptions, RspackManifestPlugin} from 'rspack-manifest-plugin';
import ReactRefreshPlugin from '@rspack/plugin-react-refresh';
import type {sentryWebpackPlugin} from '@sentry/webpack-plugin';

import type * as Babel from '@babel/core';

import paths from '../paths';
import {babelPreset} from '../babel';
import type {NormalizedClientConfig} from '../models';
import type {Logger} from '../logger';
import {ProgressPlugin} from './progress-plugin';
import {resolveTsConfigPathsToAlias} from '../webpack/utils';
import {createS3UploadPlugins} from '../s3-upload';
import {logConfig} from '../logger/log-config';

const imagesSizeLimit = 2048;
const fontSizeLimit = 8192;

type Entrypoints = Record<
    string,
    {
        assets: {
            js: string[];
            css: string[];
        };
    }
>;
export const generateManifest: ManifestPluginOptions['generate'] = (seed, files, entries) => {
    const manifestFiles = files.reduce((manifest, file) => {
        manifest[file.name] = file.path;
        return manifest;
    }, seed);
    const entrypoints = Object.keys(entries).reduce<Entrypoints>((previous, name) => {
        return {
            ...previous,
            [name]: {
                assets: {
                    js: entries[name]!.filter((file) => file.endsWith('.js')),
                    css: entries[name]!.filter((file) => file.endsWith('.css')),
                },
            },
        };
    }, {});
    return {
        files: manifestFiles,
        entrypoints,
    };
};

export interface HelperOptions {
    config: NormalizedClientConfig;
    logger?: Logger;
    isEnvDevelopment: boolean;
    isEnvProduction: boolean;
    configType: `${RspackMode}`;
}

export const enum RspackMode {
    Prod = 'production',
    Dev = 'development',
}

export async function rspackConfigFactory(
    rspackMode: RspackMode,
    config: NormalizedClientConfig,
    {logger}: {logger?: Logger} = {},
): Promise<Configuration> {
    const isEnvDevelopment = rspackMode === RspackMode.Dev;
    const isEnvProduction = rspackMode === RspackMode.Prod;

    const helperOptions: HelperOptions = {
        config,
        logger,
        isEnvDevelopment,
        isEnvProduction,
        configType: rspackMode,
    };

    let rspackConfig: Configuration = {
        mode: rspackMode,
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
        // TODO
        // externals: config.externals,
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
        cache: Boolean(config.cache),
    };

    rspackConfig = await config.rspack(rspackConfig, {configType: rspackMode});

    if (config.debugWebpack) {
        logConfig('Preview rspack config', rspackConfig);
    }

    return rspackConfig;
}

export function configureModuleRules(
    helperOptions: HelperOptions,
    additionalRules: NonNullable<RuleSetRule['oneOf']> = [],
) {
    const jsLoader = createJavaScriptLoader(helperOptions);
    return [
        ...createSourceMapRules(!helperOptions.config.disableSourceMapGeneration),
        {
            oneOf: [
                createWorkerRule(helperOptions),
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

function configureDevTool({isEnvProduction, config}: HelperOptions) {
    let format: Configuration['devtool'] = 'cheap-module-source-map';
    if (isEnvProduction) {
        format = config.hiddenSourceMap ? 'hidden-source-map' : 'source-map';
    }

    return config.disableSourceMapGeneration ? false : format;
}

function configureWatchOptions({config}: HelperOptions): Configuration['watchOptions'] {
    const watchOptions = {
        ...config.watchOptions,
        followSymlinks:
            (config.watchOptions?.followSymlinks ??
            (!config.symlinks && config.watchOptions?.watchPackages))
                ? true
                : undefined,
    };

    delete watchOptions.watchPackages;

    return watchOptions;
}

function configureExperiments({
    config,
    isEnvProduction,
}: HelperOptions): Configuration['experiments'] {
    if (isEnvProduction) {
        return undefined;
    }

    let lazyCompilation: LazyCompilationOptions | undefined;
    let port;
    let entries;

    if (config.lazyCompilation) {
        if (typeof config.lazyCompilation === 'object') {
            port = config.lazyCompilation.port;
            entries = config.lazyCompilation.entries;
        }

        lazyCompilation = {
            // See https://github.com/web-infra-dev/rspack/issues/8503
            entries: entries || false,
            imports: false,
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
                return !module.nameForCondition().endsWith('lazy-client.js');
            },
        };
    }

    return {
        // TODO not working https://github.com/web-infra-dev/rspack/issues/5658
        /*
        cache: {
            type: 'persistent',
            snapshot: {
                managedPaths: config.watchOptions?.watchPackages ? [] : undefined,
            },
        },
        */
        lazyCompilation,
    };
}

export function configureResolve({isEnvProduction, config}: HelperOptions): ResolveOptions {
    const alias: Record<string, string> = {...config.alias};

    for (const [key, value] of Object.entries(alias)) {
        alias[key] = path.resolve(paths.app, value);
    }

    if (isEnvProduction && config.reactProfiling) {
        alias['react-dom$'] = 'react-dom/profiling';
        alias['scheduler/tracing'] = 'scheduler/tracing-profiling';
    }

    const {aliases, modules = []} = resolveTsConfigPathsToAlias(paths.appClient);
    return {
        alias: {
            ...aliases,
            ...alias,
        },
        modules: ['node_modules', ...modules, ...(config.modules || [])],
        extensions: ['.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
        symlinks: config.symlinks,
        fallback: Array.isArray(config.fallback) ? undefined : config.fallback,
    };
}

function createEntryArray(entry: string) {
    return [require.resolve('./public-path'), entry];
}

function addEntry(entry: EntryObject, file: string): EntryObject {
    const newEntry = path.resolve(paths.appEntry, file);
    return {
        ...entry,
        [path.parse(file).name]: createEntryArray(newEntry),
    };
}

function configureEntry({config}: HelperOptions): EntryObject {
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

function configureOutput({isEnvDevelopment, ...rest}: HelperOptions): Configuration['output'] {
    return {
        ...getFileNames({isEnvDevelopment, ...rest}),
        path: paths.appBuild,
        pathinfo: isEnvDevelopment,
        clean: false,
    };
}

function createJavaScriptLoader({
    isEnvProduction,
    isEnvDevelopment,
    configType,
    config,
}: HelperOptions): RuleSetUseItem {
    const plugins: Babel.PluginItem[] = [];

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
            {libraryName: 'lodash', libraryDirectory: '', camel2DashComponentName: false},
        ]);
    }

    const transformOptions = config.babel(
        {
            presets: [babelPreset({newJsxTransform: config.newJsxTransform, isSsr: false})],
            plugins,
        },
        {configType, isSsr: false},
    );

    return {
        loader: require.resolve('babel-loader'),
        options: {
            sourceType: 'unambiguous',
            ...transformOptions,
            babelrc: false,
            configFile: false,
            compact: isEnvProduction,
            sourceMaps: !config.disableSourceMapGeneration,
            cacheCompression: isEnvProduction,
            cacheDirectory: config.babelCacheDirectory ? config.babelCacheDirectory : true,
        },
    };
}

function createJavaScriptRule(
    {config, isEnvProduction}: HelperOptions,
    jsLoader: RuleSetUseItem,
): RuleSetRule {
    const include = [
        paths.appClient,
        ...(config.monaco && isEnvProduction
            ? [path.resolve(paths.appNodeModules, 'monaco-editor/esm/vs')]
            : []),
        ...(config.includes || []),
    ];

    return {
        test: [/\.[jt]sx?$/, /\.[cm]js$/],
        include,
        use: jsLoader,
    };
}

function createSourceMapRules(shouldUseSourceMap: boolean): RuleSetRule[] {
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

function createWorkerRule(options: HelperOptions): RuleSetRule {
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
            createJavaScriptLoader(options),
        ],
    };
}

function createSassStylesRule(options: HelperOptions): RuleSetRule {
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
                    loadPaths: [paths.appClient],
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

function createStylesRule(options: HelperOptions): RuleSetRule {
    const loaders = getCssLoaders(options);
    return {
        test: /\.css$/,
        sideEffects: options.isEnvProduction ? true : undefined,
        use: loaders,
    };
}

function getCssLoaders(
    {isEnvDevelopment, isEnvProduction, config}: HelperOptions,
    additionalRules?: RuleSetUseItem[],
) {
    const loaders: RuleSetUseItem[] = [];

    if (!config.transformCssWithLightningCss) {
        loaders.push({
            loader: require.resolve('postcss-loader'),
            options: {
                sourceMap: !config.disableSourceMapGeneration,
                postcssOptions: {
                    config: false,
                    plugins: [
                        [require.resolve('postcss-preset-env'), {enableClientSidePolyfills: false}],
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
                filter: (url: string) => {
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
                exportOnlyLocals: false,
            },
        },
    });

    if (isEnvProduction) {
        loaders.unshift({loader: CssExtractRspackPlugin.loader});
    }

    if (isEnvDevelopment) {
        loaders.unshift({
            loader: require.resolve('style-loader'),
        });
    }

    return loaders;
}

function createIconsRule(
    {isEnvProduction, config}: HelperOptions,
    jsLoader?: RuleSetUseItem,
): RuleSetRule {
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

function createAssetsRules({isEnvProduction, config}: HelperOptions): RuleSetRule[] {
    const imagesRule = {
        test: /\.(ico|bmp|gif|jpe?g|png|svg)$/,
        include: [paths.appClient, ...(config.images || [])],
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

    const rules: RuleSetRule[] = [imagesRule, fontsRule];

    if (isEnvProduction) {
        // with dynamic public path, imports from css files will look for assets in 'css/assets' directory
        // we are enforcing loading them from 'assets'
        rules.unshift(
            {
                test: /\.(ico|bmp|gif|jpe?g|png|svg)$/,
                issuer: /\.s?css$/,
                include: [paths.appClient, ...(config.images || [])],
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
    const rules: RuleSetRule[] = [
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

/*
TODO
function createMomentTimezoneDataPlugin(options: NormalizedClientConfig['momentTz'] = {}) {
    const currentYear = new Date().getFullYear();
    // By default get data for current year only
    // https://momentjs.com/timezone/docs/#/use-it/webpack/
    const startYear = options.startYear ?? currentYear;
    const endYear = options.endYear ?? currentYear;

    return new MomentTimezoneDataPlugin({...options, startYear, endYear});
}
*/

function configurePlugins(options: HelperOptions): Configuration['plugins'] {
    const {isEnvDevelopment, isEnvProduction, config} = options;
    const excludeFromClean = config.excludeFromClean || [];

    const manifestFile = 'assets-manifest.json';

    const plugins: Configuration['plugins'] = [
        new CleanWebpackPlugin({
            verbose: config.verbose,
            cleanOnceBeforeBuildPatterns: [
                '**/*',
                ...(isEnvDevelopment ? ['!manifest.json'] : []),
                ...excludeFromClean,
            ],
        }),
        /*
        new RspackManifestPlugin({
            writeToFileEmit: true,
            publicPath: '',
        }),
        */
        new RspackManifestPlugin({
            fileName: isEnvProduction ? manifestFile : path.resolve(paths.appBuild, manifestFile),
            writeToFileEmit: true,
            useLegacyEmit: true,
            publicPath: '',
            generate: generateManifest,
        }),
        new rspack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            ...config.definitions,
        }),
    ];
    if (options.logger) {
        plugins.push(new ProgressPlugin({logger: options.logger}));
    }
    // TODO
    // if (process.env.WEBPACK_PROFILE === 'true') {
    //     plugins.push(new webpack.debug.ProfilingPlugin());
    // }

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

    if (isEnvProduction) {
        if (config.analyzeBundle === 'true') {
            plugins.push(
                new BundleAnalyzerPlugin({
                    openAnalyzer: false,
                    analyzerMode: 'static',
                    reportFilename: 'stats.html',
                }),
            );
        }
    }

    if (config.monaco) {
        const MonacoEditorWebpackPlugin = require('monaco-editor-webpack-plugin');
        plugins.push(
            new MonacoEditorWebpackPlugin({
                filename: isEnvProduction ? '[name].[hash:8].worker.js' : undefined,
                ...config.monaco,
                // currently, workers located on cdn are not working properly, so we are enforcing loading workers from
                // service instead
                publicPath: path.normalize(config.publicPathPrefix + '/build/'),
            }),
        );
    }

    const contextReplacement = config.contextReplacement || {};
    //plugins.push(createMomentTimezoneDataPlugin(config.momentTz));
    plugins.push(
        new ContextReplacementPlugin(
            /moment[\\/]locale$/,
            // eslint-disable-next-line security/detect-non-literal-regexp
            new RegExp(`^\\./(${(contextReplacement.locale || ['ru']).join('|')})$`),
        ),
    );

    plugins.push(
        new ContextReplacementPlugin(
            /dayjs[\\/]locale$/,
            // eslint-disable-next-line security/detect-non-literal-regexp
            new RegExp(`^\\./(${(contextReplacement.locale || ['ru']).join('|')})\\.js$`),
        ),
    );

    if (contextReplacement['highlight.js']) {
        plugins.push(
            new ContextReplacementPlugin(
                /highlight\.js[\\/]lib[\\/]languages$/,
                // eslint-disable-next-line security/detect-non-literal-regexp
                new RegExp(`^\\./(${contextReplacement['highlight.js'].join('|')})$`),
            ),
        );
    }

    if (isEnvDevelopment && config.reactRefresh !== false) {
        const {webSocketPath = path.normalize(`/${config.publicPathPrefix}/build/sockjs-node`)} =
            config.devServer || {};

        const {overlay, ...reactRefreshConfig} = config.reactRefresh({
            overlay: {sockPath: webSocketPath},
            exclude: [/node_modules/, /\.worker\.[jt]sx?$/],
        });

        plugins.push(
            new ReactRefreshPlugin({
                ...reactRefreshConfig,
                overlay:
                    typeof overlay === 'object'
                        ? {
                              entry: typeof overlay.entry === 'string' ? overlay.entry : undefined,
                              module:
                                  typeof overlay.module === 'string' ? overlay.module : undefined,
                              sockPath: overlay.sockPath,
                              sockHost: overlay.sockHost,
                              sockPort: overlay.sockPort?.toString(),
                              sockProtocol: overlay.sockProtocol,
                              sockIntegration:
                                  overlay.sockIntegration === 'wds' ? 'wds' : undefined,
                          }
                        : undefined,
            }),
        );
    }

    if (config.polyfill?.process) {
        plugins.push(new rspack.ProvidePlugin({process: 'process/browser.js'}));
    }

    if (isEnvProduction) {
        plugins.push(
            new CssExtractRspackPlugin({
                filename: 'css/[name].[contenthash:8].css',
                chunkFilename: 'css/[name].[contenthash:8].chunk.css',
                ignoreOrder: true,
            }),
        );

        if (config.sentryConfig) {
            const sentryPlugin: typeof sentryWebpackPlugin =
                require('@sentry/webpack-plugin').sentryWebpackPlugin;
            plugins.push(sentryPlugin({...config.sentryConfig}));
        }
    }

    if (config.cdn) {
        plugins.push(...createS3UploadPlugins(config, options.logger));
    }

    return plugins;
}

type Optimization = NonNullable<Configuration['optimization']>;
export function configureOptimization({config}: HelperOptions): Optimization {
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
    } else if (Array.isArray(configVendors)) {
        vendorsList = vendorsList.concat(configVendors);
    }

    const useVendorsList = vendorsList.length > 0;

    const optimization: Optimization = {
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                ...(useVendorsList
                    ? {
                          defaultVendors: {
                              name: 'vendors',
                              // eslint-disable-next-line security/detect-non-literal-regexp
                              test: new RegExp(
                                  `([\\\\/])node_modules\\1(${vendorsList.join('|')})\\1`,
                              ),
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
        },
        runtimeChunk: 'single',
        minimizer: [
            new rspack.SwcJsMinimizerRspackPlugin({
                minimizerOptions: {
                    mangle: !config.reactProfiling,
                    compress: {
                        passes: 2,
                    },
                    format: {
                        safari10: config.safari10,
                    },
                },
            }),
            new rspack.LightningCssMinimizerRspackPlugin({
                minimizerOptions: {
                    // TODO browserlist not working
                    targets: [
                        'last 2 major versions and last 2 years and fully supports es6 and > 0.05%',
                        'not dead',
                        'not op_mini all',
                        'not and_qq > 0',
                        'not and_uc > 0',
                        'Firefox ESR',
                        'Chrome > 0 and last 2 years and > 0.05%',
                        'Safari > 0 and last 2 years and > 0.05%',
                        'Firefox > 0 and last 2 years and > 0.01%',
                        'not safari < 15.6',
                    ],
                },
            }),
        ],
    };

    return optimization;
}
