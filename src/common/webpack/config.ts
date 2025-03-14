import * as path from 'node:path';
import * as fs from 'node:fs';
import * as webpack from 'webpack';
import {CleanWebpackPlugin} from 'clean-webpack-plugin';
import {WebpackManifestPlugin} from 'webpack-manifest-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import MiniCSSExtractPlugin from 'mini-css-extract-plugin';
import {BundleAnalyzerPlugin} from 'webpack-bundle-analyzer';
import WebpackAssetsManifest from 'webpack-assets-manifest';
import {RspackManifestPlugin} from 'rspack-manifest-plugin';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import MomentTimezoneDataPlugin from 'moment-timezone-data-webpack-plugin';
import StatoscopeWebpackPlugin from '@statoscope/webpack-plugin';
import CircularDependencyPlugin from 'circular-dependency-plugin';
import type {sentryWebpackPlugin} from '@sentry/webpack-plugin';
import {rspack} from '@rspack/core';
import type * as Rspack from '@rspack/core';
import {generateAssetsManifest} from './rspack';
import {TsCheckerRspackPlugin} from 'ts-checker-rspack-plugin';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';

import type TerserWebpackPlugin from 'terser-webpack-plugin';
import type * as Lightningcss from 'lightningcss';
import type CssMinimizerWebpackPlugin from 'css-minimizer-webpack-plugin';
import type * as Babel from '@babel/core';

import paths from '../paths';
import {babelPreset} from '../babel';
import type {NormalizedClientConfig} from '../models';
import type {Logger} from '../logger';
import {createProgressPlugin} from './progress-plugin';
import {resolveTsConfigPathsToAlias} from './utils';
import {createS3UploadPlugins} from '../s3-upload';
import {logConfig} from '../logger/log-config';
import {resolveTypescript} from '../typescript/utils';
import {nodeExternals} from './node-externals';
import type {ForkTsCheckerWebpackPluginOptions} from 'fork-ts-checker-webpack-plugin/lib/plugin-options';
import {RspackCompressedExtension} from './statoscope';

const imagesSizeLimit = 2048;
const fontSizeLimit = 8192;
const assetsManifestFile = 'assets-manifest.json';

export interface HelperOptions {
    config: NormalizedClientConfig;
    logger?: Logger;
    isEnvDevelopment: boolean;
    isEnvProduction: boolean;
    configType: `${WebpackMode}`;
    buildDirectory: string;
    entriesDirectory: string;
    isSsr: boolean;
}

export const enum WebpackMode {
    Prod = 'production',
    Dev = 'development',
}

type ClientFactoryOptions = {
    webpackMode: WebpackMode;
    config: NormalizedClientConfig;
    logger?: Logger;
    isSsr?: boolean;
};

function getHelperOptions({
    webpackMode,
    config,
    logger,
    isSsr = false,
}: ClientFactoryOptions): HelperOptions {
    const isEnvDevelopment = webpackMode === WebpackMode.Dev;
    const isEnvProduction = webpackMode === WebpackMode.Prod;

    return {
        config,
        logger,
        isEnvDevelopment,
        isEnvProduction,
        configType: webpackMode,
        buildDirectory: isSsr ? paths.appSsrBuild : paths.appBuild,
        entriesDirectory: isSsr ? paths.appSsrEntry : paths.appEntry,
        isSsr,
    };
}

function configureExternals({config, isSsr}: HelperOptions) {
    let externals = config.externals;
    if (isSsr) {
        externals =
            config.ssr?.noExternal === true
                ? undefined
                : nodeExternals({
                      noExternal: config.ssr?.noExternal,
                      module: config.ssr?.moduleType === 'esm',
                  });
    }

    return externals;
}

export async function webpackConfigFactory(
    options: ClientFactoryOptions,
): Promise<webpack.Configuration> {
    const {config} = options;
    const helperOptions = getHelperOptions(options);
    const {isSsr, isEnvProduction} = helperOptions;

    let webpackConfig: webpack.Configuration = {
        mode: isEnvProduction ? 'production' : 'development',
        context: paths.app,
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
        logConfig('Preview webpack config', webpackConfig);
    }

    return webpackConfig;
}

export async function rspackConfigFactory(
    options: ClientFactoryOptions,
): Promise<Rspack.Configuration> {
    const {config} = options;
    const helperOptions = getHelperOptions(options);
    const {isSsr, isEnvProduction, isEnvDevelopment} = helperOptions;

    // Cache is required for lazy compilation
    const cache = Boolean(config.cache) || (isEnvDevelopment && Boolean(config.lazyCompilation));

    let rspackConfig: Rspack.Configuration = {
        mode: isEnvProduction ? 'production' : 'development',
        context: paths.app,
        bail: isEnvProduction,
        target: isSsr ? 'node' : undefined,
        devtool: configureDevTool(helperOptions),
        entry: configureEntry(helperOptions),
        output: configureOutput(helperOptions),
        resolve: configureResolve(helperOptions),
        module: {
            rules: (await configureModuleRules(helperOptions)) as Rspack.RuleSetRule[],
        },
        plugins: configureRspackPlugins(helperOptions),
        optimization: configureRspackOptimization(helperOptions),
        externals: configureExternals(helperOptions) as Rspack.Configuration['externals'],
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
        logConfig('Preview rspack config', rspackConfig);
    }

    return rspackConfig;
}

export async function configureModuleRules(
    helperOptions: HelperOptions,
    additionalRules: NonNullable<webpack.RuleSetRule['oneOf']> = [],
) {
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

function configureDevTool({isEnvProduction, config}: HelperOptions) {
    let format: Rspack.Configuration['devtool'] = 'cheap-module-source-map';
    if (isEnvProduction) {
        format = config.hiddenSourceMap ? 'hidden-source-map' : 'source-map';
    }

    return config.disableSourceMapGeneration ? false : format;
}

function configureWatchOptions({config}: HelperOptions): webpack.Configuration['watchOptions'] {
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
    isSsr,
}: HelperOptions): webpack.Configuration['experiments'] {
    if (isSsr) {
        return config.ssr?.moduleType === 'esm' ? {outputModule: true} : undefined;
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

function configureRspackExperiments({
    config,
    isEnvProduction,
    isSsr,
}: HelperOptions): Rspack.Configuration['experiments'] {
    if (isSsr) {
        return config.ssr?.moduleType === 'esm' ? {outputModule: true} : undefined;
    }

    if (isEnvProduction) {
        return undefined;
    }

    let lazyCompilation: Rspack.LazyCompilationOptions | undefined;
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
                return !module.nameForCondition().endsWith('lazy-client.js');
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
                directory:
                    typeof config.cache === 'object' && 'cacheDirectory' in config.cache
                        ? config.cache.cacheDirectory
                        : undefined,
            },
        },
        lazyCompilation,
    };
}

export function configureResolve({isEnvProduction, config}: HelperOptions) {
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
        fallback: config.fallback,
    } satisfies webpack.ResolveOptions;
}

function createEntryArray(entry: string) {
    return [require.resolve('./public-path'), entry];
}

function addEntry(entry: Record<string, string | string[]>, file: string) {
    return {
        ...entry,
        [path.parse(file).name]: createEntryArray(file),
    };
}

function configureEntry({config, entriesDirectory}: HelperOptions) {
    let entries = fs.readdirSync(entriesDirectory).filter((file) => /\.[jt]sx?$/.test(file));

    if (Array.isArray(config.entryFilter) && config.entryFilter.length) {
        entries = entries.filter((entry) =>
            config.entryFilter?.includes(entry.split('.')[0] ?? ''),
        );
    }

    if (!entries.length) {
        throw new Error('No entries were found after applying entry filter');
    }

    return entries.reduce<Record<string, string | string[]>>(
        (entry, file) => addEntry(entry, path.resolve(entriesDirectory, file)),
        {},
    );
}

function getFileNames({isEnvProduction, isSsr, config}: HelperOptions) {
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

function configureOutput(options: HelperOptions) {
    let ssrOptions;
    if (options.isSsr) {
        ssrOptions = {
            library: {type: options.config.ssr?.moduleType === 'esm' ? 'module' : 'commonjs2'},
            chunkFormat: false,
        } satisfies NonNullable<webpack.Configuration['output']>;
    }
    return {
        ...getFileNames(options),
        path: options.buildDirectory,
        pathinfo: options.isEnvDevelopment,
        ...ssrOptions,
    } satisfies NonNullable<webpack.Configuration['output']>;
}

async function createJavaScriptLoader({
    isEnvProduction,
    isEnvDevelopment,
    configType,
    config,
    isSsr,
}: HelperOptions): Promise<webpack.RuleSetUseItem> {
    if (config.javaScriptLoader === 'swc') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plugins: Array<[string, Record<string, any>]> = [];

        if (!isSsr && isEnvProduction) {
            plugins.push([
                require.resolve('@swc/plugin-transform-imports'),
                {
                    lodash: {transform: 'lodash/{{member}}'},
                },
            ]);
        }

        const swcConfig = await config.swc(
            {
                module: {
                    type: 'es6',
                },
                env: {
                    targets: isSsr ? {node: process.versions.node} : require('browserslist')(),
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
                                  jsonify: {minCost: 1024},
                              }
                            : undefined,
                    },
                    assumptions: {
                        privateFieldsAsProperties: true,
                        setPublicClassFields: true,
                    },
                    experimental: {plugins},
                },
                sourceMaps: !config.disableSourceMapGeneration,
            },
            {configType, isSsr},
        );

        return {
            loader:
                config.bundler === 'rspack' ? 'builtin:swc-loader' : require.resolve('swc-loader'),
            options: swcConfig,
        };
    }

    const plugins: Babel.PluginItem[] = [];

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
                {libraryName: 'lodash', libraryDirectory: '', camel2DashComponentName: false},
            ]);
        }
    }

    const babelTransformOptions = await config.babel(
        {
            presets: [babelPreset({newJsxTransform: config.newJsxTransform, isSsr})],
            plugins,
        },
        {configType, isSsr},
    );

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

function createJavaScriptRule(
    {config, isEnvProduction}: HelperOptions,
    jsLoader: webpack.RuleSetUseItem,
): webpack.RuleSetRule {
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

async function createWorkerRule(options: HelperOptions): Promise<webpack.RuleSetRule> {
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

function createSassStylesRule(options: HelperOptions): webpack.RuleSetRule {
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

function createStylesRule(options: HelperOptions): webpack.RuleSetRule {
    const loaders = getCssLoaders(options);
    return {
        test: /\.css$/,
        sideEffects: options.isEnvProduction ? true : undefined,
        use: loaders,
    };
}

function getCssLoaders(
    {isEnvDevelopment, isEnvProduction, config, isSsr}: HelperOptions,
    additionalRules?: webpack.RuleSetUseItem[],
) {
    const isRspack = config.bundler === 'rspack';
    const loaders: webpack.RuleSetUseItem[] = [];

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
                exportOnlyLocals: isSsr,
            },
        },
    });

    if (isEnvProduction) {
        loaders.unshift({
            loader: isRspack ? rspack.CssExtractRspackPlugin.loader : MiniCSSExtractPlugin.loader,
            options: {emit: !isSsr},
        });
    }

    if (isEnvDevelopment) {
        if (isSsr || config.ssr) {
            loaders.unshift({
                loader: isRspack
                    ? rspack.CssExtractRspackPlugin.loader
                    : MiniCSSExtractPlugin.loader,
                options: {emit: !isSsr},
            });
        } else {
            loaders.unshift({
                loader: require.resolve('style-loader'),
            });
        }
    }

    return loaders;
}

function createIconsRule(
    {isEnvProduction, config, isSsr}: HelperOptions,
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
                      emit: !isSsr,
                  },
              }),
    };
}

function createAssetsRules({isEnvProduction, config, isSsr}: HelperOptions): webpack.RuleSetRule[] {
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
            emit: !isSsr,
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
            emit: !isSsr,
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
                    emit: !isSsr,
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
                    emit: !isSsr,
                },
            },
        );
    }

    return rules;
}

function createFallbackRules({isEnvProduction, isSsr}: HelperOptions) {
    const rules: webpack.RuleSetRule[] = [
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

function createMomentTimezoneDataPlugin(options: NormalizedClientConfig['momentTz'] = {}) {
    const currentYear = new Date().getFullYear();
    // By default get data for current year only
    // https://momentjs.com/timezone/docs/#/use-it/webpack/
    const startYear = options.startYear ?? currentYear;
    const endYear = options.endYear ?? currentYear;

    return new MomentTimezoneDataPlugin({...options, startYear, endYear});
}

function getDefinitions({config, isSsr}: HelperOptions) {
    return {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        'process.env.IS_SSR': JSON.stringify(isSsr),
        ...config.definitions,
    };
}

type ContextReplacement = {
    resourceRegExp: RegExp;
    newResource?: any;
};

function getContextReplacements({config, isSsr}: HelperOptions): ContextReplacement[] {
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
            newResource: new RegExp(
                `^\\./(${(contextReplacement.locale || ['ru']).join('|')})\\.js$`,
            ),
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

function getForkTsCheckerOptions({
    config,
}: HelperOptions): ForkTsCheckerWebpackPluginOptions | undefined {
    return config.forkTsChecker === false
        ? undefined
        : {
              ...config.forkTsChecker,
              typescript: {
                  typescriptPath: resolveTypescript(),
                  configFile: path.resolve(paths.appClient, 'tsconfig.json'),
                  diagnosticOptions: {
                      syntactic: true,
                  },
                  mode: 'write-references',
                  ...config.forkTsChecker?.typescript,
              },
          };
}

function getCssExtractPluginOptions({isEnvProduction}: HelperOptions) {
    return {
        filename: isEnvProduction ? 'css/[name].[contenthash:8].css' : 'css/[name].css',
        chunkFilename: isEnvProduction
            ? 'css/[name].[contenthash:8].chunk.css'
            : 'css/[name].chunk.css',
        ignoreOrder: true,
    };
}

interface WebpackPlugins {
    DefinePlugin: typeof webpack.DefinePlugin;
    ContextReplacementPlugin: typeof webpack.ContextReplacementPlugin;
    ProvidePlugin: typeof webpack.ProvidePlugin;
    ProgressPlugin: ReturnType<typeof createProgressPlugin<typeof webpack.ProgressPlugin>>;
    ManifestPlugin: typeof WebpackManifestPlugin;
    TsCheckerPlugin: typeof ForkTsCheckerWebpackPlugin;
    CSSExtractPlugin: typeof MiniCSSExtractPlugin;
    RSDoctorPlugin: typeof import('@rsdoctor/webpack-plugin').RsdoctorWebpackPlugin;
}

interface RspackPlugins {
    DefinePlugin: typeof rspack.DefinePlugin;
    ContextReplacementPlugin: typeof rspack.ContextReplacementPlugin;
    ProvidePlugin: typeof rspack.ProvidePlugin;
    ProgressPlugin: ReturnType<typeof createProgressPlugin<typeof rspack.ProgressPlugin>>;
    ManifestPlugin: typeof RspackManifestPlugin;
    TsCheckerPlugin: typeof TsCheckerRspackPlugin;
    CSSExtractPlugin: typeof rspack.CssExtractRspackPlugin;
    RSDoctorPlugin: typeof import('@rsdoctor/rspack-plugin').RsdoctorRspackPlugin;
}

type BundlerPlugins<T extends 'rspack' | 'webpack'> = {
    rspack: RspackPlugins;
    webpack: WebpackPlugins;
}[T];

type Plugins<T extends 'rspack' | 'webpack'> = {
    rspack: NonNullable<Rspack.Configuration['plugins']>;
    webpack: NonNullable<webpack.Configuration['plugins']>;
}[T];

function configureCommonPlugins<T extends 'rspack' | 'webpack'>(
    options: HelperOptions,
    bundlerPlugins: BundlerPlugins<T>,
) {
    const {isEnvDevelopment, isEnvProduction, config, isSsr} = options;
    const excludeFromClean = config.excludeFromClean || [];

    const forkTsCheckerOptions = getForkTsCheckerOptions(options);

    const plugins: webpack.Configuration['plugins'] | Rspack.Configuration['plugins'] = [
        new CleanWebpackPlugin({
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
        ...(options.logger ? [new bundlerPlugins.ProgressPlugin({logger: options.logger})] : []),
        ...(forkTsCheckerOptions ? [new bundlerPlugins.TsCheckerPlugin(forkTsCheckerOptions)] : []),
    ];

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

    if (isEnvProduction || isSsr || config.ssr) {
        plugins.push(new bundlerPlugins.CSSExtractPlugin(getCssExtractPluginOptions(options)));
    }

    if (!isSsr) {
        const contextReplacements = getContextReplacements(options);

        contextReplacements.forEach(({resourceRegExp, newResource}) =>
            plugins.push(new bundlerPlugins.ContextReplacementPlugin(resourceRegExp, newResource)),
        );

        if (config.polyfill?.process) {
            plugins.push(
                new bundlerPlugins.ProvidePlugin({
                    process: 'process/browser.js',
                }),
            );
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

        plugins.push(createMomentTimezoneDataPlugin(config.momentTz));
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
        if (config.analyzeBundle === 'statoscope') {
            const customStatoscopeConfig = config.statoscopeConfig || {};

            const statoscopePlugin = new StatoscopeWebpackPlugin({
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
                    compressor === false ? [] : [new RspackCompressedExtension(compressor)];
            }

            plugins.push(statoscopePlugin);
        }

        if (config.analyzeBundle === 'rsdoctor') {
            plugins.push(
                new bundlerPlugins.RSDoctorPlugin({
                    mode: 'brief',
                }),
            );
        }

        if (config.sentryConfig) {
            const sentryPlugin: typeof sentryWebpackPlugin =
                require('@sentry/webpack-plugin').sentryWebpackPlugin;
            plugins.push(sentryPlugin({...config.sentryConfig}));
        }
    }

    if (config.cdn) {
        plugins.push(...createS3UploadPlugins(config, options.logger));
    }

    return plugins as Plugins<T>;
}

function configureWebpackPlugins(options: HelperOptions): webpack.Configuration['plugins'] {
    const {isEnvDevelopment, isEnvProduction, config, isSsr} = options;

    const plugins: WebpackPlugins = {
        DefinePlugin: webpack.DefinePlugin,
        ContextReplacementPlugin: webpack.ContextReplacementPlugin,
        ProvidePlugin: webpack.ProvidePlugin,
        ProgressPlugin: createProgressPlugin(webpack.ProgressPlugin),
        ManifestPlugin: WebpackManifestPlugin,
        TsCheckerPlugin: ForkTsCheckerWebpackPlugin,
        CSSExtractPlugin: MiniCSSExtractPlugin,
        RSDoctorPlugin: require('@rsdoctor/webpack-plugin').RsdoctorWebpackPlugin,
    };

    const webpackPlugins: webpack.Configuration['plugins'] = [
        ...configureCommonPlugins<'webpack'>(options, plugins),
        new WebpackAssetsManifest(
            isEnvProduction
                ? {
                      entrypoints: true,
                      output: assetsManifestFile,
                  }
                : {
                      entrypoints: true,
                      writeToDisk: true,
                      output: path.resolve(options.buildDirectory, assetsManifestFile),
                  },
        ),
        ...(process.env.WEBPACK_PROFILE === 'true' ? [new webpack.debug.ProfilingPlugin()] : []),
    ];

    if (!isSsr && isEnvDevelopment && config.reactRefresh !== false) {
        const {webSocketPath = path.normalize(`/${config.publicPathPrefix}/build/sockjs-node`)} =
            config.devServer || {};

        const reactRefreshConfig = config.reactRefresh({
            overlay: {sockPath: webSocketPath},
            exclude: [/node_modules/, /\.worker\.[jt]sx?$/],
        });

        webpackPlugins.push(new ReactRefreshWebpackPlugin(reactRefreshConfig));
    }

    return webpackPlugins;
}

function configureRspackPlugins(options: HelperOptions): Rspack.Configuration['plugins'] {
    const {isEnvDevelopment, isEnvProduction, config, isSsr} = options;

    const plugins: RspackPlugins = {
        DefinePlugin: rspack.DefinePlugin,
        ContextReplacementPlugin: rspack.ContextReplacementPlugin,
        ProvidePlugin: rspack.ProvidePlugin,
        ProgressPlugin: createProgressPlugin(rspack.ProgressPlugin),
        ManifestPlugin: RspackManifestPlugin,
        TsCheckerPlugin: TsCheckerRspackPlugin,
        CSSExtractPlugin: rspack.CssExtractRspackPlugin,
        RSDoctorPlugin: require('@rsdoctor/rspack-plugin').RsdoctorRspackPlugin,
    };

    const rspackPlugins: Rspack.Configuration['plugins'] = [
        ...configureCommonPlugins(options, plugins),
        new RspackManifestPlugin({
            fileName: isEnvProduction
                ? assetsManifestFile
                : path.resolve(options.buildDirectory, assetsManifestFile),
            writeToFileEmit: true,
            useLegacyEmit: true,
            publicPath: '',
            generate: generateAssetsManifest,
        }),
    ];

    if (!isSsr && isEnvDevelopment && config.reactRefresh !== false) {
        const {webSocketPath = path.normalize(`/${config.publicPathPrefix}/build/sockjs-node`)} =
            config.devServer || {};

        const {overlay, ...reactRefreshConfig} = config.reactRefresh({
            overlay: {sockPath: webSocketPath},
            exclude: [/node_modules/, /\.worker\.[jt]sx?$/],
        });

        rspackPlugins.push(
            new ReactRefreshRspackPlugin({
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

    return rspackPlugins;
}

function getOptimizationSplitChunks({config}: HelperOptions) {
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
    } as const;
}

type Optimization = NonNullable<webpack.Configuration['optimization']>;
export function configureOptimization(helperOptions: HelperOptions): Optimization {
    const {config, isSsr} = helperOptions;
    if (isSsr) {
        return {};
    }

    const optimization: Optimization = {
        splitChunks: getOptimizationSplitChunks(helperOptions),
        runtimeChunk: 'single',
        minimizer: [
            (compiler) => {
                // CssMinimizerWebpackPlugin works with MiniCSSExtractPlugin, so only relevant for production builds.
                // Lazy load the CssMinimizerPlugin plugin
                const CssMinimizerPlugin: typeof CssMinimizerWebpackPlugin = require('css-minimizer-webpack-plugin');

                if (config.transformCssWithLightningCss) {
                    const lightningCss = require('lightningcss');
                    const browserslist = require('browserslist');

                    new CssMinimizerPlugin<Partial<Lightningcss.BundleOptions<{}>>>({
                        minify: CssMinimizerPlugin.lightningCssMinify,
                        minimizerOptions: {
                            targets: lightningCss.browserslistToTargets(browserslist()),
                        },
                    }).apply(compiler);
                } else {
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
                const TerserPlugin: typeof TerserWebpackPlugin = require('terser-webpack-plugin');
                let terserOptions: TerserWebpackPlugin.TerserOptions = {
                    compress: {
                        passes: 2,
                    },
                    safari10: config.safari10,
                    mangle: !config.reactProfiling,
                };
                const {terser} = config;
                if (typeof terser === 'function') {
                    terserOptions = terser(terserOptions);
                }
                new TerserPlugin({
                    minify:
                        config.javaScriptLoader === 'swc'
                            ? TerserPlugin.swcMinify
                            : TerserPlugin.terserMinify,
                    terserOptions,
                }).apply(compiler);
            },
        ],
    };

    return optimization;
}

function configureRspackOptimization(
    helperOptions: HelperOptions,
): NonNullable<Rspack.Configuration['optimization']> {
    const {config, isSsr} = helperOptions;
    if (isSsr) {
        return {};
    }

    let cssMinimizer: Rspack.Plugin;

    if (config.transformCssWithLightningCss) {
        cssMinimizer = new rspack.LightningCssMinimizerRspackPlugin();
    } else {
        const CssMinimizerPlugin: typeof CssMinimizerWebpackPlugin = require('css-minimizer-webpack-plugin');
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

    let swcMinifyOptions: Rspack.SwcJsMinimizerRspackPluginOptions = {
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

    const {swcMinimizerOptions} = config;

    if (typeof swcMinimizerOptions === 'function') {
        swcMinifyOptions = swcMinimizerOptions(swcMinifyOptions);
    }

    const optimization: Rspack.Configuration['optimization'] = {
        splitChunks: getOptimizationSplitChunks(helperOptions),
        runtimeChunk: 'single',
        minimizer: [new rspack.SwcJsMinimizerRspackPlugin(swcMinifyOptions), cssMinimizer],
    };

    return optimization;
}
