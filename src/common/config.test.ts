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
    const BUILD_PATH = path.normalize('/build/');
    const CDN_1 = {bucket: 'bucket-1', publicPath: 'https://cdn1.example.com/build/'};
    const CDN_2 = {bucket: 'bucket-2', publicPath: 'https://cdn2.example.com/build/'};

    async function getFallbacks(client: ClientConfig, mode?: string) {
        const normalized = await normalizeConfig({client}, mode);
        return normalized.client.publicPathFallbacks;
    }

    it('should be disabled by default', async () => {
        await expect(getFallbacks({})).resolves.toEqual([]);
    });

    it('should be disabled when cdn is configured but the option is not set', async () => {
        await expect(getFallbacks({cdn: [CDN_1, CDN_2]})).resolves.toEqual([]);
    });

    it('should derive candidates from the cdn array and append publicPath', async () => {
        await expect(
            getFallbacks({cdn: [CDN_1, CDN_2], publicPathFallback: true}),
        ).resolves.toEqual([
            {publicPath: CDN_1.publicPath},
            {publicPath: CDN_2.publicPath},
            {publicPath: BUILD_PATH},
        ]);
    });

    it('should support a single cdn object', async () => {
        await expect(getFallbacks({cdn: CDN_1, publicPathFallback: true})).resolves.toEqual([
            {publicPath: CDN_1.publicPath},
            {publicPath: BUILD_PATH},
        ]);
    });

    it('should skip cdn entries without publicPath', async () => {
        await expect(
            getFallbacks({cdn: [{bucket: 'no-public-path'}, CDN_2], publicPathFallback: true}),
        ).resolves.toEqual([{publicPath: CDN_2.publicPath}, {publicPath: BUILD_PATH}]);
    });

    it('should add a trailing slash to candidates', async () => {
        await expect(
            getFallbacks({
                cdn: [{bucket: 'b', publicPath: 'https://cdn1.example.com/build'}],
                publicPathFallback: true,
            }),
        ).resolves.toEqual([{publicPath: CDN_1.publicPath}, {publicPath: BUILD_PATH}]);
    });

    it('should deduplicate candidates keeping the first occurrence', async () => {
        await expect(
            getFallbacks({
                cdn: [CDN_1, {...CDN_1, bucket: 'another-bucket'}],
                publicPathFallback: true,
            }),
        ).resolves.toEqual([{publicPath: CDN_1.publicPath}, {publicPath: BUILD_PATH}]);
    });

    it('should not append local publicPath when includeLocalPublicPath is false', async () => {
        await expect(
            getFallbacks({
                cdn: [CDN_1, CDN_2],
                publicPathFallback: {includeLocalPublicPath: false},
            }),
        ).resolves.toEqual([{publicPath: CDN_1.publicPath}, {publicPath: CDN_2.publicPath}]);
    });

    it('should be disabled when includeLocalPublicPath is false and there is a single cdn', async () => {
        await expect(
            getFallbacks({cdn: [CDN_1], publicPathFallback: {includeLocalPublicPath: false}}),
        ).resolves.toEqual([]);
    });

    it('should be disabled when there is nothing to fall back to', async () => {
        await expect(getFallbacks({publicPathFallback: true})).resolves.toEqual([]);
    });

    it('should be disabled when the only cdn publicPath equals publicPath', async () => {
        await expect(
            getFallbacks({
                publicPath: '/build/',
                cdn: [{bucket: 'b', publicPath: '/build/'}],
                publicPathFallback: true,
            }),
        ).resolves.toEqual([]);
    });

    it('should convert host strings into anchored case-insensitive patterns', async () => {
        await expect(
            getFallbacks({
                cdn: [CDN_1, {...CDN_2, hosts: 'app.example.ru'}],
                publicPathFallback: true,
            }),
        ).resolves.toEqual([
            {publicPath: CDN_1.publicPath},
            {
                publicPath: CDN_2.publicPath,
                hosts: [{source: '^app\\.example\\.ru$', flags: 'i'}],
            },
            {publicPath: BUILD_PATH},
        ]);
    });

    it('should keep RegExp hosts as sources and drop stateful flags', async () => {
        await expect(
            getFallbacks({
                cdn: [{...CDN_2, hosts: [/\.example\.kz$/giu, 'app.example.kz']}],
                publicPathFallback: true,
            }),
        ).resolves.toEqual([
            {
                publicPath: CDN_2.publicPath,
                hosts: [
                    {source: '\\.example\\.kz$', flags: 'iu'},
                    {source: '^app\\.example\\.kz$', flags: 'i'},
                ],
            },
            {publicPath: BUILD_PATH},
        ]);
    });

    it('should be inert in dev mode', async () => {
        await expect(
            getFallbacks({cdn: [CDN_1, CDN_2], publicPathFallback: true}, 'dev'),
        ).resolves.toEqual([]);
    });

    it('should be disabled when moduleFederation is configured', async () => {
        await expect(
            getFallbacks({
                cdn: [CDN_1, CDN_2],
                moduleFederation: {name: 'app'},
                publicPathFallback: true,
            }),
        ).resolves.toEqual([]);
    });

    it('should be disabled when cdn upload is disabled from cli', async () => {
        // `--cdn false` sets `cdn: undefined` before normalization, see config.ts
        await expect(getFallbacks({cdn: undefined, publicPathFallback: true})).resolves.toEqual([]);
    });
});
