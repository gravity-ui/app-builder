import {ManifestPluginOptions} from 'rspack-manifest-plugin';

import type {Configuration} from '@rspack/core';

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {Logger} from '../logger';
import paths from '../../common/paths';

export function clearCacheDirectory(config: Configuration, logger: Logger) {
    if (!config.cache) {
        return;
    }

    let cacheDirectory = path.join(paths.appNodeModules, '.cache/rspack');

    if (
        typeof config.experiments?.cache === 'object' &&
        config.experiments.cache.type === 'persistent' &&
        config.experiments.cache.storage?.directory
    ) {
        cacheDirectory = config.experiments.cache.storage?.directory;
    }

    if (fs.existsSync(cacheDirectory)) {
        fs.rmdirSync(cacheDirectory, {recursive: true});
        logger.message(`Rspack cache ${cacheDirectory} successfully cleared`);
    }
}

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
