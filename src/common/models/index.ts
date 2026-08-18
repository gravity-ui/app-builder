import type MonacoEditorWebpackPlugin from 'monaco-editor-webpack-plugin';
import type {Options as MomentTzOptions} from 'moment-timezone-data-webpack-plugin';
import type {Configuration, DefinePlugin, FileCacheOptions, MemoryCacheOptions} from 'webpack';
import type {
    CircularDependencyRspackPluginOptions,
    LazyCompilationOptions,
    LightningCssMinimizerRspackPluginOptions,
    Configuration as RspackConfiguration,
    SwcJsMinimizerRspackPluginOptions,
    // TypeScript 5.6 does not know that modern Node.js can require synchronous ESM.
    // @ts-ignore -- ts-jest uses CommonJS resolution while @rspack/core 2 is ESM.
} from '@rspack/core';
import type * as Babel from '@babel/core';
import type * as Swc from '@swc/core';
import type {
    ServerConfiguration,
    Configuration as WebpackDevServerConfiguration,
} from 'webpack-dev-server';
import type {Options as CircularDependenciesOptions} from 'circular-dependency-plugin';
import type {Config as SvgrConfig} from '@svgr/core';
import type ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import type {Options as StatoscopeOptions} from '@statoscope/webpack-plugin';
import type {RsdoctorRspackPlugin} from '@rsdoctor/rspack-plugin';
import type {SentryWebpackPluginOptions} from '@sentry/webpack-plugin';
import type {WebpackMode} from '../webpack/config.js';
import type {UploadOptions} from '../s3-upload/upload.js';
import type {TerserOptions} from 'terser-webpack-plugin';
import type ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import type {moduleFederationPlugin} from '@module-federation/enhanced';
import type {PluginOptions as ReactCompilerOptions} from 'babel-plugin-react-compiler';
import type {Config as PostCSSConfig} from 'postcss-load-config';

export type Bundler = 'webpack' | 'rspack';
type JavaScriptLoader = 'babel' | 'swc';
type ServerCompiler = 'typescript' | 'swc';
type MonacoOptions = NonNullable<ConstructorParameters<typeof MonacoEditorWebpackPlugin>[0]>;
type ForkTsCheckerWebpackPluginOptions = NonNullable<
    ConstructorParameters<typeof ForkTsCheckerWebpackPlugin>[0]
>;
type ReactRefreshPluginOptions = NonNullable<
    ConstructorParameters<typeof ReactRefreshWebpackPlugin>[0]
>;

export type SwcConfig = Swc.Config & Pick<Swc.Options, 'isModule'>;

export interface Entities<T> {
    data: Record<string, T>;
    keys: string[];
}

/**
 * Dev server configuration.
 * Extends [webpack-dev-server options](https://webpack.js.org/configuration/dev-server/)
 * with app-builder-specific settings.
 */
export type DevServerConfig = Omit<
    WebpackDevServerConfiguration,
    'port' | 'server' | 'devMiddleware' | 'ipc'
> & {
    /**
     * Unix socket to listen on.
     * If `ipc` and `port` are not defined, the socket `{rootDir}/dist/run/client.sock` is used.
     */
    ipc?: string;
    /**
     * Port number to listen on. If `true`, a free port is selected automatically.
     */
    port?: number | true;
    /**
     * WebSocket path for HMR clients. Default is `/${publicPath}/sockjs-node`.
     */
    webSocketPath?: string;
    /**
     * Port for browser WebSocket connection. Default is `devServer.port`.
     */
    webSocketClientPort?: number;
    /**
     * Serve over HTTPS.
     */
    type?: 'https';
    /**
     * HTTPS server options (e.g. custom certificate).
     */
    options?: import('https').ServerOptions;
    /**
     * Write dev middleware output to disk.
     */
    writeToDisk?: boolean | ((targetPath: string) => boolean);
};

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
         * Additional Babel plugins appended to the library compile pipeline
         * (also injected into the Storybook babel-loader via configureServiceWebpackConfig).
         */
        babelPlugins?: Babel.PluginItem[];
    };
    verbose?: boolean;
}

interface LazyCompilationConfig
    extends Pick<LazyCompilationOptions, 'imports' | 'entries' | 'test'> {
    port?: number;
}

export type ModuleFederationConfig = Omit<
    moduleFederationPlugin.ModuleFederationPluginOptions,
    'name' | 'remotes'
> & {
    /**
     * Unique name of the application in the Module Federation ecosystem
     * Used as an identifier for this micro-frontend
     */
    name: string;
    /**
     * Application version, appended to the entry file name
     * When specified, the file will be named `entry-{version}.js`
     * @default undefined (file will be named `entry.js`)
     */
    version?: string;
    /**
     * Disable manifest file generation
     * @default false
     */
    disableManifest?: boolean;
    /**
     * List of remote application names that this application can load
     * Simplified alternative to originalRemotes - only names are specified
     * @example ['header', 'footer', 'navigation']
     */
    remotes?: string[];
    /**
     * List of enabled remotes for module federation
     * If not specified, all remotes will be enabled by default
     * It used only for development mode
     * @example ['header', 'navigation']
     */
    enabledRemotes?: string[];
    /**
     * Full configuration of remote applications in Module Federation format
     * Allows more detailed configuration of each remote application
     * @example { header: 'header@https://header.example.com/entry.js' }
     */
    originalRemotes?: moduleFederationPlugin.ModuleFederationPluginOptions['remotes'];
    /**
     * Enables runtime versioning for remote applications
     * When enabled, remote applications will be loaded with version in the filename
     * @default false
     */
    remotesRuntimeVersioning?: boolean;
    /**
     * CSS style isolation settings to prevent conflicts
     * between styles of different micro-frontends
     */
    isolateStyles?: {
        /**
         * Function to generate CSS class prefix
         * @param entryName - Application entry name
         * @returns Prefix string for CSS classes
         */
        getPrefix: (entryName: string) => string;
        /**
         * Function to add prefix to CSS selectors
         * @param prefix - Prefix to add
         * @param selector - Original CSS selector
         * @param prefixedSelector - Selector with added prefix
         * @param filePath - Path to the styles file
         * @returns Modified CSS selector
         */
        prefixSelector: (
            prefix: string,
            selector: string,
            prefixedSelector: string,
            filePath: string,
        ) => string;
    };
    /**
     * Put all assets to a folder with the name of Module Federation app name
     *
     * @default true
     */
    isolateAssets?: boolean;
};

export type WebWorkerHandle = 'loader' | 'cdn-compat' | 'none';

export interface ClientWebpackConfig {
    bundler?: Extract<Bundler, 'webpack'>;
    rspack?: never;
    /**
     * Modify or return a custom Webpack config.
     */
    webpack?: (
        config: Configuration,
        options: {configType: `${WebpackMode}`; isSsr?: boolean},
    ) => Configuration | Promise<Configuration>;
    /**
     * Detect modules with circular dependencies
     */
    detectCircularDependencies?: true | CircularDependenciesOptions;
}

export interface ClientRspackConfig {
    bundler: Extract<Bundler, 'rspack'>;
    webpack?: never;
    /**
     * Modify or return a custom Rspack config.
     */
    rspack?: (
        config: RspackConfiguration,
        options: {configType: `${WebpackMode}`; isSsr?: boolean},
    ) => RspackConfiguration | Promise<RspackConfiguration>;
    /**
     * Detect modules with circular dependencies
     */
    detectCircularDependencies?: true | CircularDependencyRspackPluginOptions;
}

export interface ClientCommonConfig {
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
     * publicPath prefix, will be added to '/build/'
     */
    publicPathPrefix?: string;
    /**
     * publicPath for bundler
     * This option has higher priority than publicPathPrefix
     */
    publicPath?: string;
    /**
     * Build directory for output
     * Default: 'dist/public/build' and 'dist/ssr' - for SSR
     */
    outputPath?: string;
    /**
     * File name for assets manifest
     * Default: 'assets-manifest.json'
     */
    assetsManifestFile?: string;
    /**
     * Add monaco-editor support
     */
    monaco?: Pick<MonacoOptions, 'filename' | 'languages' | 'features' | 'customLanguages'>;
    /**
     * if false - source maps will be generated for prod builds
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
    fallback?: {[index: string]: string | false | string[]};
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
    /**
     * entry for bundler
     * Overrides entry which is generated from entries directory
     */
    entry?: string | string[] | Record<string, string | string[]>;
    entryFilter?: string[];
    excludeFromClean?: string[];
    analyzeBundle?: 'true' | 'statoscope' | 'rsdoctor';
    statoscopeConfig?: Partial<StatoscopeOptions>;
    /** Rsdoctor plugin options. Requires `analyzeBundle: 'rsdoctor'`. */
    rsdoctorConfig?: Omit<
        Partial<NonNullable<ConstructorParameters<typeof RsdoctorRspackPlugin>[0]>>,
        'mode'
    >;
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
     * Enable React Compiler (babel-plugin-react-compiler).
     *
     * For React 17/18 set `target` and install `react-compiler-runtime`:
     * ```ts
     * reactCompiler: { target: '18' }
     * ```
     *
     * For gradual adoption use `sources` to limit compilation to specific files:
     * ```ts
     * // compile only files inside a specific directory
     * reactCompiler: { sources: (filename) => filename.includes('/src/features/my-feature/') }
     *
     * // or pass an array of directory paths
     * reactCompiler: { sources: ['src/features/new-feature', 'src/components/Button'] }
     * ```
     */
    reactCompiler?: boolean | ReactCompilerOptions;
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
    // TODO(DakEnviy): Allow only one cdn config
    cdn?: CdnUploadConfig | CdnUploadConfig[];
    /**
     * Retry loading async chunks from another public path when the current one fails.
     *
     * When a chunk fails to load, the runtime switches to the next candidate public path
     * and sticks to it for all subsequent loads. Failures are reported with `console.warn`.
     *
     * The candidate list is fully resolved at build time from `cdn[*].publicPath`
     * (in declaration order) with `publicPath` appended last. Entries with `cdn[*].hosts`
     * are only used when `location.hostname` matches, which allows per-region backups.
     *
     * Has no effect in dev mode, with `moduleFederation`,
     * or when fewer than two distinct candidates are resolved.
     *
     * @default false
     */
    publicPathFallback?: boolean | PublicPathFallbackConfig;
    /**
     * use webpack 5 Web Workers [syntax](https://webpack.js.org/guides/web-workers/#syntax)
     *
     * @deprecated use `webWorkerHandle` instead
     */
    newWebWorkerSyntax?: boolean;
    /**
     * How workers are handled
     * Worker entry point should have `.worker.ts` postfix
     *
     * Files, that match this pattern would be handle with one of the strategies:
     * - 'loader' - `worker-rspack-loader` would be used
     * - 'cdn-compat' - bundler will handle WebWorker syntax, but we also rebuild this worker, to correctly handle publicPath from variable for imports inside worker
     *
     * @see https://www.npmjs.com/package/worker-rspack-loader
     * @see https://webpack.js.org/guides/web-workers/
     */
    webWorkerHandle?: WebWorkerHandle;
    babelCacheDirectory?: boolean | string;
    cache?: boolean | FileCacheOptions | MemoryCacheOptions;
    /** Use [Lighting CSS](https://lightningcss.dev) to transform and minimize css instead of PostCSS and cssnano*/
    transformCssWithLightningCss?: boolean;
    sentryConfig?: SentryWebpackPluginOptions;
    /**
     * Modify or return a custom Babel config.
     */
    babel?: (
        config: Babel.TransformOptions,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => Babel.TransformOptions | Promise<Babel.TransformOptions>;
    /**
     * Modify or return a custom SWC config.
     */
    swc?: (
        config: SwcConfig,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => SwcConfig | Promise<SwcConfig>;
    /**
     * Modify or return a custom [Terser options](https://github.com/terser/terser#minify-options).
     */
    terser?: (options: TerserOptions) => TerserOptions;

    /**
     * Modify or return a custom [SWC minification options](https://swc.rs/docs/configuration/minification).
     * Available with rspack bundler.
     */
    swcMinimizerOptions?: (
        options: SwcJsMinimizerRspackPluginOptions,
    ) => SwcJsMinimizerRspackPluginOptions;

    /** Modify or return a custom [LightningCssMinimizerRspackPlugin](https://rspack.dev/plugins/rspack/lightning-css-minimizer-rspack-plugin) */
    lightningCssMinimizerOptions?: (
        options: LightningCssMinimizerRspackPluginOptions,
    ) => LightningCssMinimizerRspackPluginOptions;

    /**
     * CSS Loader configuration options
     * Allows to override default css-loader settings
     * @see https://github.com/webpack/css-loader#options
     */
    cssLoader?: Partial<CssLoaderOptions>;

    /**
     * Modify or return a custom [PostCSS loader options]
     * @see https://github.com/webpack/postcss-loader#options.
     */
    postCssLoaderOptions?: (
        options: Partial<ExtendedPostCSSConfig>,
    ) => Partial<ExtendedPostCSSConfig>;

    ssr?: {
        noExternal?: string | RegExp | (string | RegExp)[] | true;
        moduleType?: 'commonjs' | 'esm';
    };
    bundler?: Bundler;
    javaScriptLoader?: JavaScriptLoader;

    /**
     * Module Federation configuration for building micro-frontends
     * @see https://module-federation.io/
     */
    moduleFederation?: ModuleFederationConfig;
}

export type ClientConfig = ClientCommonConfig & (ClientWebpackConfig | ClientRspackConfig);

export interface ExtendedPostCSSConfig extends Omit<PostCSSConfig, 'plugins'> {
    /**
     * Enables/Disables autoloading config.
     * @see https://github.com/webpack/postcss-loader#boolean
     */
    config?: boolean;
    /**
     * Additional plugins to be added to the postcss plugins list.
     * Each plugin is represented as a tuple of [pluginName, pluginOptions].
     */
    plugins?: Array<[string, object]>;
}

export interface CdnUploadConfig {
    bucket: string;
    prefix?: string;
    region?: string;
    endpoint?: string;
    /**
     * Maximum number of S3 request attempts, including the initial request.
     * @default 5
     */
    maxAttempts?: number;
    /** @default 'adaptive' */
    retryMode?: 'standard' | 'adaptive';
    publicPath?: string;
    compress?: boolean;
    cacheControl?: UploadOptions['cacheControl'];
    /**
     * pattern for additional files in build that need to be loaded to CDN
     */
    additionalPattern?: string | string[];
    /**
     * Hosts this CDN may be used on by the `publicPathFallback` runtime.
     *
     * A string is matched against the whole `location.hostname`, case-insensitively;
     * use a RegExp for anything else. When omitted, the CDN is used on every host.
     *
     * Affects only the runtime fallback, never the upload — files are still uploaded
     * to every configured bucket.
     *
     * @example ['app.example.ru', /\.example\.kz$/]
     */
    hosts?: CdnHostPattern | CdnHostPattern[];
}

export type CdnHostPattern = string | RegExp;

export interface PublicPathFallbackConfig {
    /**
     * Append `publicPath` (`/build/` by default) as the last candidate.
     *
     * @default true
     */
    includeLocalPublicPath?: boolean;
}

/**
 * A single candidate for the `publicPathFallback` runtime, serialized into the client
 * bundle with `DefinePlugin`. `hosts` holds `RegExp` sources rather than `RegExp`
 * instances because it has to survive `JSON.stringify`.
 */
export interface PublicPathFallback {
    publicPath: string;
    hosts?: {source: string; flags: string}[];
}

export interface ServerConfig {
    port?: number | true;
    watch?: string[];
    watchThrottle?: number;
    inspect?: number | true;
    inspectBrk?: number | true;

    /**
     * Compiler for server code compilation
     * @default 'typescript'
     */
    compiler?: ServerCompiler;

    /**
     * Additional options for SWC compilation.
     * Works only if `compiler` is 'swc'.
     */
    swcOptions?: {
        additionalPaths?: string[];
        exclude?: string | string[];
    };

    /**
     * Custom output path for compiled server code.
     * Can be only relative to dist path.
     * @default 'server'
     * @example 'package/src/server'
     */
    outputPath?: string;
}
export interface ServiceConfig {
    target?: 'client' | 'server';
    client?: ClientConfig;
    server?: ServerConfig;
    lib?: never;
    verbose?: boolean;
    configPath?: string;
}

export type NormalizedClientWebpackConfig = {
    bundler: Extract<Bundler, 'webpack'>;
    webpack: (
        config: Configuration,
        options: {configType: `${WebpackMode}`; isSsr?: boolean},
    ) => Configuration | Promise<Configuration>;
    detectCircularDependencies: CircularDependenciesOptions | true | undefined;
    rspack: undefined;
};

export type NormalizedClientRspackConfig = {
    bundler: Extract<Bundler, 'rspack'>;
    rspack: (
        config: RspackConfiguration,
        options: {configType: `${WebpackMode}`; isSsr?: boolean},
    ) => RspackConfiguration | Promise<RspackConfiguration>;
    detectCircularDependencies: CircularDependencyRspackPluginOptions | true | undefined;
    webpack: undefined;
};

export type NormalizedClientBaseConfig = Omit<
    ClientConfig,
    | 'publicPathPrefix'
    | 'publicPath'
    | 'assetsManifestFile'
    | 'hiddenSourceMap'
    | 'svgr'
    | 'lazyCompilation'
    | 'devServer'
    | 'disableForkTsChecker'
    | 'disableReactRefresh'
    | 'transformCssWithLightningCss'
    | 'reactCompiler'
    | 'webpack'
    | 'rspack'
    | 'detectCircularDependencies'
> & {
    reactCompiler: boolean | ReactCompilerOptions;
    javaScriptLoader: JavaScriptLoader;
    // TODO(DakEnviy): Use cdn to calculate publicPath and merge with browserPublicPath
    /**
     * Build public path
     * (concatenated with micro-frontend name if module federation is configured).
     */
    publicPath: string;
    /**
     * Public path for CDN,
     * it presents even if CDN is disabled.
     */
    cdnPublicPath?: string;
    /**
     * Final public path for browser,
     * it is based on cdnPublicPath if CDN is enabled or publicPath otherwise
     * (concatenated with micro-frontend name if module federation is configured).
     */
    browserPublicPath: string;
    /**
     * Ordered list of public paths the runtime may load async chunks from,
     * derived from `publicPathFallback`, `cdn` and `publicPath`.
     * Empty if the fallback is disabled.
     */
    publicPathFallbacks: PublicPathFallback[];
    assetsManifestFile: string;
    hiddenSourceMap: boolean;
    svgr: NonNullable<ClientConfig['svgr']>;
    lazyCompilation?: LazyCompilationConfig;
    devServer?: Omit<DevServerConfig, 'port' | 'type' | 'options'> & {
        port?: number;
        server?: ServerConfiguration;
    };
    verbose?: boolean;
    transformCssWithLightningCss: boolean;
    /**
     * CSS Loader configuration with default values merged with user overrides
     */
    cssLoaderConfig: CssLoaderOptions;
    debugWebpack?: boolean;
    babel: (
        config: Babel.TransformOptions,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => Babel.TransformOptions | Promise<Babel.TransformOptions>;
    swc: (
        config: SwcConfig,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => SwcConfig | Promise<SwcConfig>;
    reactRefresh: NonNullable<ClientConfig['reactRefresh']>;
};

export type NormalizedClientConfig = NormalizedClientBaseConfig &
    (NormalizedClientWebpackConfig | NormalizedClientRspackConfig);

export type NormalizedServerConfig = Omit<
    ServerConfig,
    'port' | 'inspect' | 'inspectBrk' | 'compiler' | 'outputPath'
> & {
    port?: number;
    verbose?: boolean;
    inspect?: number;
    inspectBrk?: number;
    compiler: ServerCompiler;
    outputPath: string;
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

/**
 * CSS Loader options interface
 * @see https://github.com/webpack/css-loader#options
 */
export interface CssLoaderOptions {
    /**
     * Allows to enables/disables `url()`/`image-set()` functions handling.
     * @see https://github.com/webpack/css-loader#url
     */
    url?: boolean | {filter: (url: string, resourcePath: string) => boolean};

    /**
     * Allows to enables/disables `@import` at-rules handling.
     * @see https://github.com/webpack/css-loader#import
     */
    import?: boolean | {filter: (url: string, media: string, resourcePath: string) => boolean};

    /**
     * Allows to enable/disable CSS Modules or ICSS and setup configuration.
     * @see https://github.com/webpack/css-loader#modules
     */
    modules?: boolean | 'local' | 'global' | 'pure' | 'icss' | CssLoaderModulesOptions;

    /**
     * Allows to enable/disable source maps.
     * @see https://github.com/webpack/css-loader#sourcemap
     */
    sourceMap?: boolean;

    /**
     * Use the ES modules syntax.
     * @see https://github.com/webpack/css-loader#esmodule
     */
    esModule?: boolean;

    /**
     * Allows exporting styles as array with modules, string or constructable stylesheet (i.e. `CSSStyleSheet`).
     * @see https://github.com/webpack/css-loader#exporttype
     */
    exportType?: 'array' | 'string' | 'css-style-sheet';
}

/**
 * CSS Modules configuration options
 * @see https://github.com/webpack/css-loader#modules
 */
export interface CssLoaderModulesOptions {
    /**
     * Allows auto enable CSS modules based on filename.
     * @see https://github.com/webpack/css-loader#auto
     */
    auto?: RegExp | ((resourcePath: string) => boolean) | boolean;

    /**
     * Setup `mode` option.
     * @see https://github.com/webpack/css-loader#mode
     */
    mode?:
        | 'local'
        | 'global'
        | 'pure'
        | 'icss'
        | ((resourcePath: string) => 'local' | 'global' | 'pure' | 'icss');

    /**
     * Allows to configure the generated local ident name.
     * @see https://github.com/webpack/css-loader#localidentname
     */
    localIdentName?: string;

    /**
     * Allows to redefine basic loader context for local ident name.
     * @see https://github.com/webpack/css-loader#localidentcontext
     */
    localIdentContext?: string;

    /**
     * Allows to add custom hash to generate more unique classes.
     * @see https://github.com/webpack/css-loader#localidenthashsalt
     */
    localIdentHashSalt?: string;

    /**
     * Allows to specify hash function to generate classes.
     * @see https://github.com/webpack/css-loader#localidenthashfunction
     */
    localIdentHashFunction?: string;

    /**
     * Allows to specify hash digest to generate classes.
     * @see https://github.com/webpack/css-loader#localidenthashdigest
     */
    localIdentHashDigest?: string;

    /**
     * Allows to specify hash digest length to generate classes.
     * @see https://github.com/webpack/css-loader#localidenthashdigestlength
     */
    localIdentHashDigestLength?: number;

    /**
     * Allows to specify should localName be used when computing the hash.
     * @see https://github.com/webpack/css-loader#hashstrategy
     */
    hashStrategy?: 'resource-path-and-local-name' | 'minimal-subset';

    /**
     * Allows to specify custom RegExp for local ident name.
     * @see https://github.com/webpack/css-loader#localidentregexp
     */
    localIdentRegExp?: string | RegExp;

    /**
     * Allows to specify a function to generate the classname.
     * @see https://github.com/webpack/css-loader#getlocalident
     */
    getLocalIdent?: (
        context: {
            resourcePath: string;
            resourceQuery: string;
        },
        localIdentName: string,
        localName: string,
        options: CssLoaderModulesOptions,
    ) => string;

    /**
     * Enables/disables ES modules named export for locals.
     * @see https://github.com/webpack/css-loader#namedexport
     */
    namedExport?: boolean;

    /**
     * Allows to export names from global class or id, so you can use that as local name.
     * @see https://github.com/webpack/css-loader#exportglobals
     */
    exportGlobals?: boolean;

    /**
     * Style of exported classnames.
     * @see https://github.com/webpack/css-loader#localsconvention
     */
    exportLocalsConvention?:
        | 'asIs'
        | 'as-is'
        | 'camelCase'
        | 'camel-case'
        | 'camelCaseOnly'
        | 'camel-case-only'
        | 'dashes'
        | 'dashesOnly'
        | 'dashes-only'
        | ((className: string) => string);

    /**
     * Export only locals.
     * @see https://github.com/webpack/css-loader#exportonlylocals
     */
    exportOnlyLocals?: boolean;

    /**
     * Allows outputting of CSS modules mapping through a callback.
     * @see https://github.com/webpack/css-loader#getJSON
     */
    getJSON?: (cssModules: Record<string, string>) => void;
}
