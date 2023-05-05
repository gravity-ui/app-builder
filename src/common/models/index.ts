import type {EditorLanguage} from 'monaco-editor-webpack-plugin/out/languages';
import type {EditorFeature} from 'monaco-editor-webpack-plugin/out/features';
import type {IFeatureDefinition} from 'monaco-editor-webpack-plugin/out/types';
import type {Options as MomentTzOptions} from 'moment-timezone-data-webpack-plugin';
import type {Configuration, ResolveOptions, DefinePlugin} from 'webpack';
import type {ServerConfiguration} from 'webpack-dev-server';
import type {Options as CircularDependenciesOptions} from 'circular-dependency-plugin';

export interface Entities<T> {
    data: Record<string, T>;
    keys: string[];
}

export interface LinkedPackage {
    name: string;
    location: string;
    nodeModules: string[];
    package?: string;
    restorePackageFrom?: string;
    typescript?: boolean;
}

interface DevServerConfig {
    ipc?: string;
    port?: number | true;
    webSocketPath?: string;
    type?: 'https';
    options?: import('https').ServerOptions;
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
    lib?: {
        internalDirs?: string[];
    };
    /**
     * Use new JSX Transform
     */
    newJsxTransform?: boolean;
    verbose?: boolean;
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
     * Additional paths fro images
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
     * additional libraries for vendor chunk
     */
    vendors?: string[];
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
     */
    safari10?: boolean;
    /**
     * svgr plugin options.
     */
    svgr?: Object;
    entryFilter?: string[];
    excludeFromClean?: string[];
    analyzeBundle?: 'true' | 'statoscope';
    reactProfiling?: boolean;
    /**
     *  Disable react-refresh in dev mode
     */
    disableReactRefresh?: boolean;
    /**
     * Detect modules with circular dependencies
     */
    detectCircularDependencies?: true | CircularDependenciesOptions;
    /**
     * use new JSX Transform
     */
    newJsxTransform?: boolean;
    disableForkTsChecker?: boolean;
    disableSourceMapGeneration?: boolean;
    lazyCompilation?:
        | boolean
        | {
              port?: number;
          };
    polyfill?: {
        process?: boolean;
    };
    // Add additional options to DefinePlugin
    definitions?: DefinePlugin['definitions'];
    watchOptions?: Configuration['watchOptions'];
    cdn?: CdnUploadConfig | CdnUploadConfig[];
}

interface CdnUploadConfig {
    bucket: string;
    prefix?: string;
    region?: string;
    endpoint?: string;
    compress?: boolean;
    /**
     * pattern for additional files in build that need to be loaded to CDN
     */
    additionalPattern?: string | string[];
}

export interface ServerConfig {
    port?: number | true;
    watch?: string[];
    watchThrottle?: number;
    inspect?: number;
    inspectBrk?: number;
}
export interface ServiceConfig {
    target?: 'client' | 'server';
    client?: ClientConfig;
    server?: ServerConfig;
    link?: string;
    verbose?: boolean;
}

export type NormalizedClientConfig = Omit<
    ClientConfig,
    'publicPathPrefix' | 'hiddenSourceMap' | 'svgr' | 'lazyCompilation' | 'devServer'
> & {
    publicPathPrefix: string;
    hiddenSourceMap: boolean;
    svgr: NonNullable<ClientConfig['svgr']>;
    lazyCompilation?: {port: number};
    devServer: Omit<DevServerConfig, 'port' | 'type' | 'options'> & {
        port?: number;
        server: ServerConfiguration;
    };
    verbose?: boolean;
};

export type NormalizedServerConfig = Omit<ServerConfig, 'serverPort'> & {
    serverPort?: number;
    verbose?: boolean;
};

export type NormalizedServiceConfig = Omit<ServiceConfig, 'client' | 'server'> & {
    client: NormalizedClientConfig;
    server: NormalizedServerConfig;
};

export type ProjectConfig = {
    // TODO: config extension support
    // extends?: Array<string | [appBuilderConfigPackage: string, options: unknown]>;
} & (ServiceConfig | LibraryConfig);

export type AppBuilderConfigPackage = (options?: unknown) => ProjectConfig;

export type ProjectFileConfig =
    | ProjectConfig
    | ((mode: 'dev' | 'build', env?: Record<string, any>) => ProjectConfig);

export function isServiceConfig(config: ProjectConfig): config is ServiceConfig {
    return !('lib' in config);
}

export function isLibraryConfig(config: ProjectConfig): config is LibraryConfig {
    return 'lib' in config;
}
