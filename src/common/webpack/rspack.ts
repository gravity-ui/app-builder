import {ManifestPluginOptions} from 'rspack-manifest-plugin';

type Entrypoints = Record<
    string,
    {
        assets: {
            js: string[];
            css: string[];
        };
    }
>;

export const generateAssetsManifest: ManifestPluginOptions['generate'] = (seed, files, entries) => {
    const manifestFiles = files.reduce((manifest, file) => {
        manifest[file.name] = file.path;
        return manifest;
    }, seed);

    const entrypoints = Object.keys(entries).reduce<Entrypoints>((previous, name) => {
        return {
            ...previous,
            [name]: {
                assets: {
                    js: entries[name]!.filter((file) => file.endsWith('.js')),
                    css: entries[name]!.filter((file) => file.endsWith('.css')),
                },
            },
        };
    }, {});

    return {
        ...manifestFiles,
        entrypoints,
    };
};
