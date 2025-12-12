import type {EditorLanguage} from 'monaco-editor-webpack-plugin/out/languages';
import type {EditorFeature} from 'monaco-editor-webpack-plugin/out/features';
import type {IFeatureDefinition} from 'monaco-editor-webpack-plugin/out/types';
import type {Options as MomentTzOptions} from 'moment-timezone-data-webpack-plugin';
import type {Configuration, DefinePlugin, FileCacheOptions, MemoryCacheOptions} from 'webpack';
import type {
    LightningCssMinimizerRspackPluginOptions,
    Configuration as RspackConfiguration,
    SwcJsMinimizerRspackPluginOptions,
} from '@rspack/core';
import type * as Babel from '@babel/core';
import type * as Swc from '@swc/core';
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
import type {moduleFederationPlugin} from '@module-federation/enhanced';

type Bundler = 'webpack' | 'rspack';
type JavaScriptLoader = 'babel' | 'swc';
type ServerCompiler = 'typescript' | 'swc';

export type SwcConfig = Swc.Config & Pick<Swc.Options, 'isModule'>;

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
};

export type WebWorkerHandle = 'loader' | 'cdn-compat' | 'none';

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
    monaco?: {
        filename?: string;
        languages?: EditorLanguage[];
        features?: EditorFeature[];
        customLanguages?: IFeatureDefinition[];
    };
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
    // TODO(DakEnviy): Allow only one cdn config
    cdn?: CdnUploadConfig | CdnUploadConfig[];
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

export interface CdnUploadConfig {
    bucket: string;
    prefix?: string;
    region?: string;
    endpoint?: string;
    publicPath?: string;
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
}
export interface ServiceConfig {
    target?: 'client' | 'server';
    client?: ClientConfig;
    server?: ServerConfig;
    lib?: never;
    verbose?: boolean;
    configPath?: string;
}

export type NormalizedClientConfig = Omit<
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
> & {
    bundler: Bundler;
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
    webpack: (
        config: Configuration,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => Configuration | Promise<Configuration>;
    rspack: (
        config: RspackConfiguration,
        options: {configType: `${WebpackMode}`; isSsr: boolean},
    ) => RspackConfiguration | Promise<RspackConfiguration>;
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

export type NormalizedServerConfig = Omit<
    ServerConfig,
    'port' | 'inspect' | 'inspectBrk' | 'compiler'
> & {
    port?: number;
    verbose?: boolean;
    inspect?: number;
    inspectBrk?: number;
    compiler: ServerCompiler;
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
