import {isLibraryConfig} from '../../common/models/index.js';
import type {NormalizedConfig} from '../../common/models/index.js';

export default async function (config: NormalizedConfig) {
    process.env.NODE_ENV = 'production';
    if (isLibraryConfig(config)) {
        const {default: buildLibrary} = await import('./build-lib.js');
        return buildLibrary(config);
    }

    const {default: buildService} = await import('./build-service/index.js');
    return buildService(config);
}
