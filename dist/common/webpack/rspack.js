"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAssetsManifest = void 0;
const generateAssetsManifest = (seed, files, entries) => {
    const manifestFiles = files.reduce((manifest, file) => {
        manifest[file.name] = file.path;
        return manifest;
    }, seed);
    const entrypoints = Object.keys(entries).reduce((previous, name) => {
        return {
            ...previous,
            [name]: {
                assets: {
                    js: entries[name].filter((file) => file.endsWith('.js')),
                    css: entries[name].filter((file) => file.endsWith('.css')),
                },
            },
        };
    }, {});
    return {
        ...manifestFiles,
        entrypoints,
    };
};
exports.generateAssetsManifest = generateAssetsManifest;
