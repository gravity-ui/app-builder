import {normalizeConfig} from './config';
import type {ClientConfig, CssLoaderOptions} from './models';

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
