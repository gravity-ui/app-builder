import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {getProjectConfig, normalizeConfig} from './config.js';
import type {ClientConfig, CssLoaderOptions} from './models/index.js';

describe('configuration loading', () => {
    it('loads a conditional ESM config', async () => {
        const configDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-builder-config-'));
        const configPath = path.join(configDir, 'app-builder.config.mjs');

        await fs.promises.writeFile(
            configPath,
            "export default (command, env) => ({lib: {internalDirs: [command + '-' + env.channel]}});",
        );

        try {
            await expect(
                getProjectConfig('build', {
                    config: configPath,
                    // yargs types this as the pre-coercion string array.
                    env: {channel: 'next'} as unknown as string[],
                }),
            ).resolves.toMatchObject({
                lib: {internalDirs: ['build-next']},
            });
        } finally {
            await fs.promises.rm(configDir, {recursive: true, force: true});
        }
    });
});

// Type guard for url filter
function isUrlFilterObject(
    url: CssLoaderOptions['url'],
): url is {filter: (url: string, resourcePath: string) => boolean} {
    return typeof url === 'object' && url !== null && 'filter' in url;
}

describe('cssLoader configuration', () => {
    it('should apply default cssLoader config when not specified', async () => {
        const clientConfig: ClientConfig = {};
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig).toEqual({
            url: {
                filter: expect.any(Function),
            },
            sourceMap: true,
            modules: {
                auto: true,
                localIdentName: '[name]__[local]--[hash:base64:5]',
                exportLocalsConvention: 'camelCase',
            },
        });

        // Check that url filter works correctly
        const url = normalized.client.cssLoaderConfig.url;
        if (isUrlFilterObject(url)) {
            expect(url.filter('data:image/png;base64,abc', '/path/to/file.css')).toBe(false);
            expect(url.filter('./image.png', '/path/to/file.css')).toBe(true);
        }
    });

    it('should merge user cssLoader config with defaults', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                modules: {
                    localIdentName: '[local]--[hash:base64:8]',
                    exportLocalsConvention: 'camelCaseOnly',
                },
                sourceMap: false,
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig).toEqual({
            url: {
                filter: expect.any(Function),
            },
            sourceMap: false,
            modules: {
                auto: true,
                localIdentName: '[local]--[hash:base64:8]',
                exportLocalsConvention: 'camelCaseOnly',
            },
        });
    });

    it('should allow complete override of cssLoader config', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                url: false,
                import: false,
                modules: false,
                sourceMap: false,
                esModule: false,
                exportType: 'array',
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig).toEqual({
            url: false,
            import: false,
            modules: false,
            sourceMap: false,
            esModule: false,
            exportType: 'array',
        });
    });

    it('should allow partial override of modules config', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                modules: {
                    localIdentName: 'custom-[local]',
                },
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.modules).toEqual({
            auto: true,
            localIdentName: 'custom-[local]',
            exportLocalsConvention: 'camelCase',
        });
    });

    it('should allow modules to be a boolean', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                modules: true,
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.modules).toBe(true);
    });

    it('should allow modules to be a string', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                modules: 'local',
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.modules).toBe('local');
    });

    it('should allow url to be a boolean', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                url: false,
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.url).toBe(false);
    });

    it('should allow url to be an object with filter', async () => {
        const customFilter = (url: string) => url.endsWith('.png');
        const clientConfig: ClientConfig = {
            cssLoader: {
                url: {
                    filter: customFilter,
                },
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.url).toEqual({
            filter: customFilter,
        });
    });

    it('should respect disableSourceMapGeneration for sourceMap', async () => {
        const clientConfig: ClientConfig = {
            disableSourceMapGeneration: true,
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.sourceMap).toBe(false);
    });

    it('should allow user to override sourceMap even with disableSourceMapGeneration', async () => {
        const clientConfig: ClientConfig = {
            disableSourceMapGeneration: true,
            cssLoader: {
                sourceMap: true,
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.sourceMap).toBe(true);
    });

    it('should allow import to be a boolean', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                import: false,
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.import).toBe(false);
    });

    it('should allow import to be an object with filter', async () => {
        const customFilter = (_url: string, media: string) => media === 'screen';
        const clientConfig: ClientConfig = {
            cssLoader: {
                import: {
                    filter: customFilter,
                },
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.import).toEqual({
            filter: customFilter,
        });
    });

    it('should allow setting exportType', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                exportType: 'css-style-sheet',
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.exportType).toBe('css-style-sheet');
    });

    it('should allow setting esModule', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                esModule: false,
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.esModule).toBe(false);
    });

    it('should allow complex modules configuration', async () => {
        const clientConfig: ClientConfig = {
            cssLoader: {
                modules: {
                    auto: /\.module\.css$/,
                    mode: 'local',
                    localIdentName: '[path][name]__[local]--[hash:base64:5]',
                    localIdentContext: 'src',
                    localIdentHashSalt: 'custom-salt',
                    localIdentHashFunction: 'sha256',
                    localIdentHashDigest: 'hex',
                    localIdentHashDigestLength: 10,
                    hashStrategy: 'resource-path-and-local-name',
                    namedExport: true,
                    exportGlobals: true,
                    exportLocalsConvention: 'dashes',
                    exportOnlyLocals: false,
                },
            },
        };
        const normalized = await normalizeConfig({client: clientConfig});

        expect(normalized.client.cssLoaderConfig.modules).toEqual({
            auto: /\.module\.css$/,
            mode: 'local',
            localIdentName: '[path][name]__[local]--[hash:base64:5]',
            localIdentContext: 'src',
            localIdentHashSalt: 'custom-salt',
            localIdentHashFunction: 'sha256',
            localIdentHashDigest: 'hex',
            localIdentHashDigestLength: 10,
            hashStrategy: 'resource-path-and-local-name',
            namedExport: true,
            exportGlobals: true,
            exportLocalsConvention: 'dashes',
            exportOnlyLocals: false,
        });
    });
});

describe('publicPathFallback configuration', () => {
    const CDN = 'https://cdn.example.com/build/';
    const RU = 'https://cdn.example.ru/build/';
    const LOCAL = '/build/';

    async function getFallbacks(client: ClientConfig, mode?: string) {
        const normalized = await normalizeConfig({client}, mode);
        return normalized.client.publicPathFallbacks;
    }

    it('should be disabled by default', async () => {
        await expect(getFallbacks({})).resolves.toEqual([]);
    });

    it('should be disabled for an empty list', async () => {
        await expect(getFallbacks({publicPathFallback: []})).resolves.toEqual([]);
    });

    it('should keep a single candidate, since the page public path is prepended at runtime', async () => {
        await expect(getFallbacks({publicPathFallback: [LOCAL]})).resolves.toEqual([
            {publicPath: LOCAL},
        ]);
    });

    it('should accept string and object entries and keep their order', async () => {
        await expect(
            getFallbacks({publicPathFallback: [CDN, {publicPath: RU}, LOCAL]}),
        ).resolves.toEqual([{publicPath: CDN}, {publicPath: RU}, {publicPath: LOCAL}]);
    });

    it('should ignore the cdn config', async () => {
        await expect(
            getFallbacks({
                cdn: [{bucket: 'bucket', publicPath: CDN}],
                publicPathFallback: [RU, LOCAL],
            }),
        ).resolves.toEqual([{publicPath: RU}, {publicPath: LOCAL}]);
    });

    it('should add a trailing slash to candidates', async () => {
        await expect(
            getFallbacks({publicPathFallback: ['https://cdn.example.com/build', LOCAL]}),
        ).resolves.toEqual([{publicPath: CDN}, {publicPath: LOCAL}]);
    });

    it('should deduplicate candidates keeping the first occurrence', async () => {
        await expect(
            getFallbacks({publicPathFallback: [CDN, {publicPath: CDN, hosts: /\.ru$/}, LOCAL]}),
        ).resolves.toEqual([{publicPath: CDN}, {publicPath: LOCAL}]);
    });

    it('should skip entries with an empty publicPath', async () => {
        await expect(getFallbacks({publicPathFallback: ['', RU, LOCAL]})).resolves.toEqual([
            {publicPath: RU},
            {publicPath: LOCAL},
        ]);
    });

    it('should convert host strings into anchored case-insensitive patterns', async () => {
        await expect(
            getFallbacks({publicPathFallback: [{publicPath: RU, hosts: 'app.example.ru'}, LOCAL]}),
        ).resolves.toEqual([
            {publicPath: RU, hosts: [{source: '^app\\.example\\.ru$', flags: 'i'}]},
            {publicPath: LOCAL},
        ]);
    });

    it('should keep RegExp hosts as sources and drop stateful flags', async () => {
        await expect(
            getFallbacks({
                publicPathFallback: [
                    {publicPath: RU, hosts: [/\.example\.ru$/giu, 'app.example.ru']},
                ],
            }),
        ).resolves.toEqual([
            {
                publicPath: RU,
                hosts: [
                    {source: '\\.example\\.ru$', flags: 'iu'},
                    {source: '^app\\.example\\.ru$', flags: 'i'},
                ],
            },
        ]);
    });

    it('should be inert in dev mode', async () => {
        await expect(getFallbacks({publicPathFallback: [RU, LOCAL]}, 'dev')).resolves.toEqual([]);
    });

    it('should be disabled when moduleFederation is configured', async () => {
        await expect(
            getFallbacks({moduleFederation: {name: 'app'}, publicPathFallback: [RU, LOCAL]}),
        ).resolves.toEqual([]);
    });
});
