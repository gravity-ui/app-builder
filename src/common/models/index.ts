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
    moment?: string[];
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

export interface WebpackConfig {
    /**
     * добавляет импорт шорт-каты для указанных папок, в примере выше если в `ui/libs/` лежит
     *     модуль `my-awesome-local-lib`, его можно добавлять через `import tools from my-awesome-local-lib`. Для
     *     поддержки typescript необходимо этот шорткат также добавить в поле paths tsconfig.json.
     */
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
     * если выставить в false - для продовых сборок будут генерироваться полноценные сорс-мапы,
     */
    hiddenSourceMap?: boolean;
    /**
     * дополнить список библиотек, которые попадут в чанк
     */
    vendors?: string[];
    /**
     * опциональные [настройки](https://www.npmjs.com/package/moment-timezone-data-webpack-plugin) для исторических данных moment-timezone (по умолчанию данные обрезаются)
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
     * Follow symbolic links while looking for a file. [Описание опции](https://webpack.js.org/configuration/resolve/#resolvesymlinks)
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
}

export interface ServiceConfig extends WebpackConfig {
    /**
     * паттерны для отслеживания файлов, при изменении которых сервер перезапустится
     */
    serverWatch?: string[];
    /**
     * перезапускать сервер не чаще, чем через указанное количество миллисекунд
     */
    serverWatchThrottle?: number;
    /**
     * Specify a port number to listen to for server requests
     */
    serverPort?: number | true;
    inspect?: number;
    inspectBrk?: number;
    link?: string;
    target?: 'client' | 'server';
    verbose?: boolean;
}

export type NormalizedServiceConfig = Omit<
    ServiceConfig,
    'publicPathPrefix' | 'hiddenSourceMap' | 'svgr' | 'lazyCompilation' | 'devServer' | 'serverPort'
> & {
    publicPathPrefix: string;
    hiddenSourceMap: boolean;
    svgr: NonNullable<ServiceConfig['svgr']>;
    lazyCompilation?: {port: number};
    devServer: Omit<DevServerConfig, 'port' | 'type' | 'options'> & {
        port?: number;
        server: ServerConfiguration;
    };
    serverPort?: number;
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
