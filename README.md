# @gravity-ui/app-builder &middot; [![npm package](https://img.shields.io/npm/v/@gravity-ui/app-builder)](https://www.npmjs.com/package/@gravity-ui/app-builder) [![CI](https://img.shields.io/github/actions/workflow/status/gravity-ui/app-builder/.github/workflows/ci.yml?branch=main)](https://github.com/gravity-ui/app-builder/actions/workflows/ci.yml?query=branch:main)

Develop and build your client-server projects, powered by typescript and webpack.

## Install

```shell
npm install --save-dev @gravity-ui/app-builder
```

## Usage

`@gravity-ui/app-builder` provides CLI (`npx app-builder`). You can view available commands with the `--help` flag.

### Develop your project

```sh
npx app-builder dev # to view supported options add the --help flag.
```

### Build your project

```sh
npx app-builder build # to view supported options add the --help flag.
```

### Configuration

You can use any of these files:

- app-builder.config.ts
- app-builder.config.js
- app-builder.config.json
- app-builder property in your package.json

You can also specify a custom filename using the `--config` flag

#### TypeScript/JavaScript

```ts
import {defineConfig} from '@gravity-ui/app-builder';

export default defineConfig({
  client: {
    // client settings
  },
  server: {
    // server settings
  },
});
```

#### Conditional config

If the config needs to be conditionally determined, it can export a function instead:

```ts
import {defineConfig} from '@gravity-ui/app-builder';

export default defineConfig(async function (
  /** @type dev | build */
  command,
  /**
   * values specified with --env flag
   *
   * @type {[k in string]: string}
   *
   * @example
   *   With follow command:
   *       app-build dev --env=path.to.member1=value1 --env=path.to.member2=value2
   *   you get:
   *       env = {path: {to: {member1: 'value1', member2: 'value2'}}}
   */
  env,
) {
  return {
    verbose: command === 'dev',
    client: {
      // client settings
    },
    server: {
      // server settings
    },
  };
});

export default config;
```

#### package.json

```json
{
  "app-builder": {
    "client": {
      // client settings
    },
    "server": {
      // server settings
    }
  },
  "scripts": {
    "dev": "app-builder dev",
    "build": "app-builder build"
  }
}
```

### Common

- `target` (`client | server`) — select compilation unit.
- `verbose` (`boolean`) - turn on verbose output.

### Server

`app-builder` compiles server with typescript.
Default folder for server code is `src/server`. There is must be file `tsconfig.json`

```json
{
  "compilerOptions": {
    "outDir": "../../dist/server"
  }
}
```

and `index.ts` - server entrypoint.

`outDir` - must be configured to place compiled files to `{rootDir}/dist/server`.
The server is started with the command `node {rootDir}/dist/server/index.js`.

#### Options

All server settings are used only in dev mode:

- `port` (`number | true`) — specify port that server listens. The port will be used to
  pass through requests from the client to the server. If set to `true`, the port will be selected automatically.
  The server is started with the command `APP_PORT=${port} node dist/server/index.js --port ${port}`.
- `watch` (`string[]`) — by default `app-builder` monitors only `src/server` directory.
  If you need to watch other directories, specify them here.
- `watchThrottle` (`number`) — use to add an extra throttle, or delay restarting.
- `inspect/inspectBrk` (`number | true`) — listen for a debugging client on specified port.
  If specified `true`, try to listen on `9229`.

### Client

`app-builder` bundles client with [webpack](https://webpack.js.org). Client code must be in `src/ui` folder.
`src/ui/entries` - each file in this folder is used as entrypoint. `dist/public/build` is output directory for bundles.

#### Options

All paths must be specified relative `rootDir` of the project.

- `modules` (`string[]`) — Tell webpack what directories should be searched when resolving modules. `modules` automatically
  populates with `baseUrl` from `src/ui/tsconfig.json`.
- `alias` (`Record<string, string>`) — Create aliases to import or require certain modules more easily, [more](https://webpack.js.org/configuration/resolve/#resolvealias)

With this `{rootDir}/src/ui/tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseDir": ".",
    "paths": {
      "~units": ["units/*"]
    }
  }
}
```

`modules` will contain `["{rootDir}/src"]` and aliases - `{"~units": ["{rootDir}/src/units"]}`;

- `includes` (`string[]`) — additional compilation paths. Example: `includes: ['node_modules/my-lib', 'src/shared']`
- `images` (`string[]`) — Additional paths for images. Example: `images: ['node_modules/my-lib/img']`
- `icons` (`string[]`) — Additional paths for svg icons. By default, all svgs with paths including `icons/` will be processed.
  Example: `icons: [node_modules/@fortawesome/fontawesome-pro/svgs]`
- `publicPathPrefix` (`string`) — publicPath prefix, will be added to `/build/`
- `symlinks` (`boolean`) — Follow symbolic links while looking for a file. [more](https://webpack.js.org/configuration/resolve/#resolvesymlinks)
- `externals` — specify dependencies that shouldn't be resolved by webpack, but should become dependencies of the resulting bundle. [more](https://webpack.js.org/configuration/externals/)
- `node` — include polyfills or mocks for various node stuff. [more](https://webpack.js.org/configuration/node/)
- `fallback` — Redirect module requests when normal resolving fails. [more](https://webpack.js.org/configuration/resolve/#resolvefallback)
- `polyfill` — allow enable Node.js `process` object polyfill.
- `hiddenSourceMap` (`boolean=true`) - if `false` - source maps will be generated for prod builds
- `disableSourceMapGeneration` (`boolean`) — disable sourcemap generation;
- `definitions` — add additional options to DefinePlugin. [more](https://webpack.js.org/plugins/define-plugin/#usage)
- `newJsxTransform` (`boolean=true`) — use new JSX Transform.
- `svgr` (`SvgrConfig`) — svgr plugin options. [more](https://react-svgr.com/docs/options/)
- `entryFilter` (`string[]`) — filter used entrypoints.
- `excludeFromClean` (`string[]`) — do not clean provided paths before build.
- `forkTsCheker` (`false | ForkTsCheckerWebpackPluginOptions`) - config for ForkTsCheckerWebpackPlugin [more](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin#options). If `false`, ForkTsCheckerWebpackPlugin will be disabled.
- `cache` (`boolean | FileCacheOptions | MemoryCacheOptions`) — Cache the generated webpack modules and chunks to improve build speed. [more](https://webpack.js.org/configuration/cache/)
- `babelCacheDirectory` (`boolean | string`) — Set directory for babel-loader cache (`default: node_modules/.cache/babel-loader``)

##### Dev build

- `devServer` (`Object`) — webpack dev server options.
  - `ipc` (`string`) — the Unix socket to listen to. If `ipc` and `port` are not defined, then the socket `{rootDir}/dist/run/client.sock` is used.
  - `port` (`number | true`) — specify a port number to listen for requests on. If `true`, the free port will be selected automatically.
  - `webSocketPath` (`string`) — tells clients connected to devServer to use the provided path to connect. Default is `${publicPathPrefix}/build/sockjs-node`.
  - `type` (`'https'`) — allow to serve over HTTPS.
  - `options` (`import('https').ServerOptions`) — allow to provide your own certificate.
- `watchOptions` — a set of options used to customize watch mode, [more](https://webpack.js.org/configuration/watch/#watchoptions)
  - `watchPackages` (`boolean`) - watch all changes in `node_modules`.
- `disableReactRefresh` (`boolean`) — disable `react-refresh` in dev mode.
- `detectCircularDependencies` (`true | CircularDependenciesOptions`) - detect modules with circular dependencies, [more](https://github.com/aackerman/circular-dependency-plugin)
- `lazyCompilation` (`true | LazyCompilationConfig`) — enable experimental [lazy compilation](https://webpack.js.org/configuration/experiments/#experimentslazycompilation) feature
  - `true` — enable feature
  - `LazyCompilationConfig`
    - `port` (`number`) — port where to listen to from the server
    - `entries` (`boolean=true`) — if `false` - disables lazy compilation for `src/ui/entries` folder content

##### Production build

- `analyzeBundle` (`true | statoscope`) — tools to analyze bundle.
  - `true` — enable [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) plugin. Report generated to `dist/public/build/stats.html`
  - `statoscope` — enable [statoscope](https://github.com/statoscope/statoscope) plugin. Reports generated to `dist/public/build/stats.json` and `dist/public/build/report.json`
- `reactProfiling` (`boolean`) — use react profiler API in production, this option also disable minimization. The API is required by React developers tools for profile.
- `statoscopeConfig` (`Options`) — `@statoscope/webpack-plugin` [configuration options](https://github.com/statoscope/statoscope/tree/master/packages/webpack-plugin#usage). Might be used to override the defaults. Requires `analyzeBundle: statoscope`.
- `cdn` (`CdnUploadConfig | CdnUploadConfig[]`) - upload bundled client files to CDN.
  - `bucket` (`string`) — bucket name
  - `prefix` (`string`) — path to files inside the bucket
  - `region` (`string`) — AWS region or any string
  - `endpoint` (`string`) - cdn host to upload files
  - `compress` (`boolean`) - upload also gzip and brotli compressed versions of files
  - `additionalPattern` (`string[]`) — patterns for uploading additional files. By default, only files generated by webpack are loaded.

##### Optimization

- `vendors` (`string[]`) — additional libraries for vendor chunk
- `momentTz` — [settings](https://www.npmjs.com/package/moment-timezone-data-webpack-plugin) for moment-timezone (by default data is truncated);
- `contextReplacement` (`object`)
  - `highlight.js` (`string[]`) — list of language names to include, e.g. `['javascript', 'python', 'bash']`;
  - `locale`: (`string[]=['ru']`) — list of `moment.js` or `day.js` locales to include, e.g. `['de', 'es']`. Locale `En` is always present.
- `safari10` (`boolean`) — Enables `safari10` terser's option. [Terser options](https://github.com/terser/terser#minify-options)
- `transformCssWithLightningCss` (`boolean`) — use [Lighting CSS](https://lightningcss.dev) to transform and minimize css instead of PostCSS and cssnano
- `bundleSameModules` (`boolean`) — Same modules will be forced to bundle to already existed chunk, if they appeared more than once

##### Monaco editor support

- `monaco` (`object`) — use [monaco-editor-webpack-plugin](https://github.com/microsoft/monaco-editor/tree/main/webpack-plugin#monaco-editor-webpack-loader-plugin)

  - `fileName` (`string`) — custom filename template for worker scripts
  - `languages` (`string[]`) - include only a subset of the languages supported.
  - `features` (`string[]`) - include only a subset of the editor features.
  - `customLanguages` (`IFeatureDefinition[]`) - include custom languages (outside of the ones shipped with the `monaco-editor`).

##### WebWorker support

Web workers allow you to run JavaScript code in a separate thread from the main UI thread.
This can improve the performance and responsiveness of your web application by offloading
intensive tasks to the background.

To create a web worker, you need to write a script file that defines the logic of the worker. For example,
this file (my.worker.ts) implements a simple function that adds two numbers and sends the result back to the main thread:

```ts
// my.worker.ts
self.onmessage = async (ev) => {
  const {a = 0, b = 0} = ev.data || {};
  const result = a + b;
  self.postMessage({
    result,
  });
};
```

`app-builder` provides built-in support for web workers for files with the `.worker.[jt]s` suffix. You can choose
between two variants of getting web workers by setting the `newWebWorkerSyntax` option:

- `newWebWorkerSyntax: false` (default) - use the `worker-loader` to import web workers.
  Content of worker file will be included in main bundle as blob. This variant does not
  support dynamic imports inside worker. For example:

```ts
// main.ts
import MyWorker from './my.worker.ts';

const worker = new MyWorker();
```

In this variant, you need to add some type declarations for the worker files::

```ts
// worker.d.ts
declare module '*.worker.ts' {
  class WebpackWorker extends Worker {}

  export default WebpackWorker;
}
```

- `newWebWorkerSyntax: true` - use the webpack 5 web workers [syntax](https://webpack.js.org/guides/web-workers/#syntax)
  to import web workers. This variant allows to use dynamic imports inside worker and load worker bundle from CDN. For example:

```ts
import {Worker} from '@gravity-ui/app-builder/worker';

const MyWorker = new Worker(new URL('./my.worker'), import.meta.url);
```

To use the web worker in your main script, you need to communicate with it using the postMessage and onmessage methods. For example:

```ts
// main.ts

const worker = '...'; // Worker creation, first or second variant

worker.onmessage = ({data: {result}}) => {
  console.log(result);
};

worker.postMessage({a: 1, b: 2});
```
