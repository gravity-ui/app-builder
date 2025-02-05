import type {EditorLanguage} from 'monaco-editor-webpack-plugin/out/languages';
import type {EditorFeature} from 'monaco-editor-webpack-plugin/out/features';
import type {IFeatureDefinition} from 'monaco-editor-webpack-plugin/out/types';
import type {Options as MomentTzOptions} from 'moment-timezone-data-webpack-plugin';
import type {
    Configuration,
    DefinePlugin,
    FileCacheOptions,
    MemoryCacheOptions,
    ResolveOptions,
} from 'webpack';
import type {Configuration as RspackConfiguration} from '@rspack/core';
import type * as Babel from '@babel/core';
import type {ServerConfiguration} from 'webpack-dev-server';
import type {Options as CircularDependenciesOptions} from 'circular-dependency-plugin';
import type {Config as SvgrConfig} from '@svgr/core';
import type {ForkTsCheckerWebpackPluginOptions} from 'fork-ts-checker-webpack-plugin/lib/plugin-options';
import type {Options as StatoscopeOptions} from '@statoscope/webpack-plugin';
import type {SentryWebpackPluginOptions} from '@sentry/webpack-plugin';
import type {WebpackMode} from '../webpack/config';
import type {UploadOptions} from '../s3-upload/upload';
import type {TerserOptions} from 'terser-webpack-plugin';
import type {ReactRefreshPluginOptions} from '@pmmmwh/react-refresh-webpack-plugin/types/lib/types';

type Bundler = 'webpack' | 'rspack';

export interface Entities<T> {
    data: Record<string, T>;
    keys: string[];
}

interface DevServerConfig {
    ipc?: string;
    port?: number | true;
    webSocketPath?: string;
    type?: 'https';
    options?: import('https').ServerOptions;
    writeToDisk?: boolean | ((targetPath: string) => boolean);
}

interface ContextReplacement {
    'highlight.js'?: string[];
    /**
     * Used to limit loading of "moment" and "dayjs" locales
     *
     * @default ['ru']
     */
    locale?: string[];
}

export interface LibraryConfig {
    lib: {
        internalDirs?: string[];
        /**
         * Use new JSX Transform
         */
        newJsxTransform?: boolean;
    };
    verbose?: boolean;
}

interface LazyCompilationConfig {
    port?: number;
    /**
     * @default true
     * disable lazy compilation for entries
     */
    entries?: boolean;
}

export interface ClientConfig {
    modules?: string[];
    /**
     * Resolve [alias](https://webpack.js.org/configuration/resolve/#resolvealias)
     */
    alias?: Record<string, string>;
    /**
     * Additional compilation paths
     */
    includes?: string[];
    /**
     * Additional paths for images
     */
    images?: string[];
    /**
     * Additional paths for svg icons
     */
    icons?: string[];
    devServer?: DevServerConfig;
    contextReplacement?: ContextReplacement;
    /**
     *  publicPath prefix, will be added to '/build/'
     */
    publicPathPrefix?: string;
    /**
     * Add monaco-editor support
     */
    monaco?: {
        filename?: string;
        languages?: EditorLanguage[];
        features?: EditorFeature[];
        customLanguages?: IFeatureDefinition[];
    };
    /**
     * if false - source maps will be generated for prod builds,
     */
    hiddenSourceMap?: boolean;
    /**
     * additional libraries or a function returning libraries for a vendor chunk
     */
    vendors?: string[] | ((defaultVendors: string[]) => string[]);
    /**
     * [settings](https://www.npmjs.com/package/moment-timezone-data-webpack-plugin) for moment-timezone (by default data is truncated)
     */
    momentTz?: MomentTzOptions;
    /**
     * Specify dependencies that shouldn't be resolved by webpack, but should become dependencies of the resulting bundle. The kind of the dependency depends on `output.libraryTarget`.
     */
    externals?: Configuration['externals'];
    /**
     * Include polyfills or mocks for various node stuff.
     */
    node?: Configuration['node'];
    /**
     * Redirect module requests when normal resolving fails.
     */
    fallback?: ResolveOptions['fallback'];
    /**
     * Follow symbolic links while looking for a file. [more](https://webpack.js.org/configuration/resolve/#resolvesymlinks)
     */
    symlinks?: boolean;
    /**
     * Enables `safari10` terser's option. [Terser options](https://github.com/terser/terser#minify-options)
     *
     * @deprecated use `terser` option instead
     */
    safari10?: boolean;
    /**
     * svgr plugin options.
     */
    svgr?: SvgrConfig;
    entryFilter?: string[];
    excludeFromClean?: string[];
    analyzeBundle?: 'true' | 'statoscope' | 'rsdoctor';
    statoscopeConfig?: Partial<StatoscopeOptions>;
    reactProfiling?: boolean;
    /**
     * Disable react-refresh in dev mode
     *
     * @deprecated use `reactRefresh: false` instead
     */
    disableReactRefresh?: boolean;
    /** Disable or configure react-refresh in dev mode */
    reactRefresh?: false | ((options: ReactRefreshPluginOptions) => ReactRefreshPluginOptions);
    /**
     * Detect modules with circular dependencies
     */
    detectCircularDependencies?: true | CircularDependenciesOptions;
    /**
     * use new JSX Transform
     */
    newJsxTransform?: boolean;
    /**
     * @deprecated use `forkTsChecker: false` instead
     */
    disableForkTsChecker?: boolean;
    forkTsChecker?: false | ForkTsCheckerWebpackPluginOptions;
    disableSourceMapGeneration?: boolean;
    lazyCompilation?: boolean | LazyCompilationConfig;
    polyfill?: {
        process?: boolean;
    };
    /**
     * Add additional options to DefinePlugin
     */
    definitions?: DefinePlugin['definitions'];
    watchOptions?: Configuration['watchOptions'] & {
        /**
         * watch changes in node_modules
         */
        watchPackages?: boolean;
    };
    cdn?: CdnUploadConfig | CdnUploadConfig[];
    /**
     * use webpack 5 Web Workers [syntax](https://webpack.js.org/guides/web-workers/#syntax)
     */
    newWebWorkerSyntax?: boolean;
    babelCacheDirectory?: boolean | string;
    cache?: boolean | FileCacheOptions | MemoryCacheOptions;
    /** Use [Lighting CSS](https://lightningcss.dev) to transform and minimize css instead of PostCSS and cssnano*/
    transformCssWithLightningCss?: boolean;
    sentryConfig?: SentryWebpackPluginOptions;
    /**
     * Modify or return a custom Webpack config.
     */
    webpack?: (
        config: Configuration,
        options: {configType: `${WebpackMode}`; isSsr?: boolean},
    ) => Configuration | Promise<Configuration>;
    /**
     * Modify or return a custom Rspack config.
     */
    rspack?: (
        config: RspackConfiguration,
        options: {configType: `${WebpackMode}`; isSsr?: boolean},
    ) => RspackConfiguration | Promise<RspackConfiguration>;
    /**
     * Modify or return a custom Babel config.
     */
    babel?: (
        config: Babel.TransformOptions,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => Babel.TransformOptions | Promise<Babel.TransformOptions>;
    /**
     * Modify or return a custom [Terser options](https://github.com/terser/terser#minify-options).
     */
    terser?: (options: TerserOptions) => TerserOptions;
    ssr?: {
        noExternal?: string | RegExp | (string | RegExp)[] | true;
        moduleType?: 'commonjs' | 'esm';
    };
    bundler?: Bundler;
}

export interface CdnUploadConfig {
    bucket: string;
    prefix?: string;
    region?: string;
    endpoint?: string;
    compress?: boolean;
    cacheControl?: UploadOptions['cacheControl'];
    /**
     * pattern for additional files in build that need to be loaded to CDN
     */
    additionalPattern?: string | string[];
}

export interface ServerConfig {
    port?: number | true;
    watch?: string[];
    watchThrottle?: number;
    inspect?: number | true;
    inspectBrk?: number | true;
}
export interface ServiceConfig {
    target?: 'client' | 'server';
    client?: ClientConfig;
    server?: ServerConfig;
    lib?: never;
    verbose?: boolean;
}

export type NormalizedClientConfig = Omit<
    ClientConfig,
    | 'publicPathPrefix'
    | 'hiddenSourceMap'
    | 'svgr'
    | 'lazyCompilation'
    | 'devServer'
    | 'disableForkTsChecker'
    | 'disableReactRefresh'
> & {
    bundler: Bundler;
    publicPathPrefix: string;
    hiddenSourceMap: boolean;
    svgr: NonNullable<ClientConfig['svgr']>;
    lazyCompilation?: LazyCompilationConfig;
    devServer?: Omit<DevServerConfig, 'port' | 'type' | 'options'> & {
        port?: number;
        server?: ServerConfiguration;
    };
    verbose?: boolean;
    webpack: (
        config: Configuration,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => Configuration | Promise<Configuration>;
    rspack: (
        config: RspackConfiguration,
        options: {configType: `${WebpackMode}`},
    ) => RspackConfiguration | Promise<RspackConfiguration>;
    debugWebpack?: boolean;
    babel: (
        config: Babel.TransformOptions,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => Babel.TransformOptions | Promise<Babel.TransformOptions>;
    reactRefresh: NonNullable<ClientConfig['reactRefresh']>;
};

export type NormalizedServerConfig = Omit<ServerConfig, 'port' | 'inspect' | 'inspectBrk'> & {
    port?: number;
    verbose?: boolean;
    inspect?: number;
    inspectBrk?: number;
};

export type NormalizedServiceConfig = Omit<ServiceConfig, 'client' | 'server'> & {
    client: NormalizedClientConfig;
    server: NormalizedServerConfig;
};

export type ProjectConfig = ServiceConfig | LibraryConfig;
export type NormalizedConfig = NormalizedServiceConfig | LibraryConfig;

export type AppBuilderConfigPackage = (options?: unknown) => ProjectConfig;

export type ProjectFileConfig =
    | ProjectConfig
    | ((
          mode: 'dev' | 'build',
          env?: Record<string, string | boolean | {} | undefined>,
      ) => ProjectConfig | Promise<ProjectConfig>);

export function isServiceConfig(config: ProjectConfig): config is ServiceConfig {
    return !('lib' in config);
}

export function isLibraryConfig(config: ProjectConfig): config is LibraryConfig {
    return 'lib' in config;
}

export function defineConfig(config: ProjectFileConfig) {
    return config;
}
