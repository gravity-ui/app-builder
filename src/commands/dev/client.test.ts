import * as fs from 'node:fs';
import {jest} from '@jest/globals';
import type WebpackDevServer from 'webpack-dev-server';
import type {Configuration} from 'webpack-dev-server';

import type {Bundler, DevServerConfig, NormalizedServiceConfig} from '../../common/models/index.js';

const webpackCompiler = {options: {plugins: []}};
const rspackCompiler = {...webpackCompiler, rspack: true};
const afterEmit = {tap: jest.fn()};
const lazyMiddleware = jest.fn();
const createLazyMiddleware = jest.fn(() => lazyMiddleware);
let options: Configuration;

class MockDevServer {
    compiler: typeof webpackCompiler | typeof rspackCompiler;

    constructor(serverOptions: Configuration, compiler: typeof webpackCompiler) {
        options = serverOptions;
        this.compiler = compiler;
    }

    async start() {}
}

jest.unstable_mockModule('webpack', () => ({default: () => webpackCompiler}));
jest.unstable_mockModule('webpack-dev-server', () => ({default: MockDevServer}));
jest.unstable_mockModule('@rspack/core', () => ({
    rspack: () => rspackCompiler,
    lazyCompilationMiddleware: createLazyMiddleware,
}));
jest.unstable_mockModule('@rspack/dev-server', () => ({RspackDevServer: MockDevServer}));
jest.unstable_mockModule('webpack-assets-manifest', () => ({default: class {}}));
jest.unstable_mockModule('webpack-manifest-plugin', () => ({
    getCompilerHooks: () => ({afterEmit}),
}));
jest.unstable_mockModule('rspack-manifest-plugin', () => ({
    getCompilerHooks: () => ({afterEmit}),
}));
jest.unstable_mockModule('../../common/webpack/config.js', () => ({
    WebpackMode: {Dev: 'development'},
    webpackConfigFactory: async () => ({}),
    rspackConfigFactory: async () => ({}),
}));

const {watchClientCompilation} = await import('./client.js');

async function start(bundler: Bundler, devServer: DevServerConfig = {}, lazyCompilation = false) {
    const config = {
        client: {
            bundler,
            publicPath: '/build/',
            devServer: {port: 8010, ...devServer},
            lazyCompilation: lazyCompilation ? {port: 6000} : undefined,
        },
        server: {},
    } as NormalizedServiceConfig;

    await watchClientCompilation(config, jest.fn());
}

beforeEach(() => {
    jest.clearAllMocks();
});

it.each(['webpack', 'rspack'] as const)(
    '%s keeps the default output file system',
    async (bundler) => {
        await start(bundler);

        expect(options.devMiddleware?.outputFileSystem).toBeUndefined();
    },
);

it.each(['webpack', 'rspack'] as const)(
    '%s passes the selected file system to dev middleware without changing defaults',
    async (bundler) => {
        const writeToDisk = jest.fn(() => true);
        await start(bundler, {outputFileSystem: fs, writeToDisk});

        expect(options).not.toHaveProperty('outputFileSystem');
        expect(options.devMiddleware).toMatchObject({
            outputFileSystem: fs,
            publicPath: '/build/',
            stats: 'errors-warnings',
        });
        expect(options.hot).toBe(true);
        expect(options.liveReload).toBe(false);
        const filter = options.devMiddleware?.writeToDisk;
        expect(typeof filter).toBe('function');
        if (typeof filter === 'function') {
            expect(filter('/build/main.js')).toBe(true);
        }
        expect(writeToDisk).toHaveBeenCalledWith('/build/main.js');
    },
);

it('preserves the Rspack lazy compilation middleware with disk output', async () => {
    await start('rspack', {outputFileSystem: fs}, true);

    const middlewares = options.setupMiddlewares?.([], {} as WebpackDevServer);
    expect(createLazyMiddleware).toHaveBeenCalledWith(rspackCompiler);
    expect(middlewares).toEqual([lazyMiddleware]);
    expect(options.devMiddleware?.outputFileSystem).toBe(fs);
});
