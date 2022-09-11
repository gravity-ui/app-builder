import {isLibraryConfig} from '../../common/models';
import type {ProjectConfig} from '../../common/models';

export default async function (config: ProjectConfig) {
    process.env.NODE_ENV = 'production';
    const {default: build} = await import(
        isLibraryConfig(config) ? './build-lib' : './build-service'
    );
    return build(config);
}
